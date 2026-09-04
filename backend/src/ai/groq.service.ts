import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// The shape of a chat turn, matching the OpenAI/Groq wire format. We keep
// our own type instead of importing an SDK — Groq's API IS the
// OpenAI-compatible REST contract, so a ~100-line fetch wrapper is all we
// need, with no dependency to keep patched and no hidden ret/timeout
// behaviour we don't control.
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  /** Override the default model for this call (e.g. the fast model for hints). */
  model?: string;
  /** 0 = deterministic. Lower for grading/feedback, higher for conversation. */
  temperature?: number;
  maxTokens?: number;
  /** Ask the model to emit a single JSON object (Groq "JSON mode"). */
  json?: boolean;
  /** Abort the request if the model hasn't responded in this many ms. */
  timeoutMs?: number;
}

interface GroqChoice {
  message: { role: string; content: string };
  finish_reason: string;
}
interface GroqResponse {
  model: string;
  choices: GroqChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fastModel: string;

  constructor(private readonly config: ConfigService) {
    // Read config once in the constructor, not on every call — and fail
    // loud at boot if the key is missing rather than at the first user
    // request. `getOrThrow` turns a misconfigured deploy into a startup
    // crash, which is the cheapest possible place to notice it.
    this.apiKey = this.config.getOrThrow<string>('GROQ_API_KEY');
    this.baseUrl = this.config.get<string>(
      'GROQ_BASE_URL',
      'https://api.groq.com/openai/v1',
    );
    this.defaultModel = this.config.get<string>(
      'GROQ_MODEL',
      'openai/gpt-oss-120b',
    );
    this.fastModel = this.config.get<string>(
      'GROQ_FAST_MODEL',
      'openai/gpt-oss-20b',
    );
  }

  get models() {
    return { default: this.defaultModel, fast: this.fastModel };
  }

  /**
   * One non-streaming chat completion. Returns the assistant's text.
   * Retries once on any transient failure (network, 5xx, provider
   * hiccup) — an interview turn or a piece of feedback shouldn't die
   * because the provider blipped for 200ms.
   */
  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    try {
      return await this.chatOnce(messages, opts);
    } catch {
      return this.chatOnce(messages, opts);
    }
  }

  private async chatOnce(
    messages: ChatMessage[],
    opts: ChatOptions = {},
  ): Promise<string> {
    const body = {
      model: opts.model ?? this.defaultModel,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 1024,
      // response_format is the OpenAI/Groq switch for "JSON mode": the
      // decoder is constrained so the output parses as one JSON object.
      // It doesn't guarantee a *particular schema* — we still validate
      // the parsed shape in chatJson() below.
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    };

    // AbortController is the only portable way to bound a fetch(). Without
    // it, an LLM provider having a bad day would hang our request (and the
    // user's HTTP request behind it) until the socket eventually dies.
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      opts.timeoutMs ?? 30_000,
    );

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      // Network error or our own abort — both surface to the caller as a
      // 503, never a 500. An upstream dependency being down is not our
      // bug, and the client should treat it as "try again later".
      this.logger.error(
        `Groq request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException('AI service is unavailable');
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`Groq ${res.status}: ${detail.slice(0, 500)}`);
      // 429 from upstream is worth passing through as a 503 too — the
      // caller can't do anything smarter than back off.
      throw new ServiceUnavailableException('AI service returned an error');
    }

    const data = (await res.json()) as GroqResponse;
    const text = data.choices?.[0]?.message?.content ?? '';
    if (data.usage) {
      // Token usage is the cost signal — log it so we can see which
      // features are expensive without reaching for the provider dashboard.
      this.logger.log(
        `${data.model} · ${data.usage.prompt_tokens}+${data.usage.completion_tokens} tok`,
      );
    }
    return text.trim();
  }

  /**
   * chat() + parse, with a schema-shape check supplied by the caller.
   * LLMs in JSON mode still occasionally return a well-formed object with
   * the wrong keys; `validate` is the guard that turns that into a clean
   * 503 instead of an undefined-property crash three layers up.
   */
  async chatJson<T>(
    messages: ChatMessage[],
    validate: (value: unknown) => value is T,
    opts: ChatOptions = {},
  ): Promise<T> {
    // One retry. Structured-output failures from an LLM (unparseable, or
    // parseable-but-wrong-shape, or the provider's own JSON validator
    // rejecting a generation) are transient often enough that a single
    // re-ask is worth more than it costs. Only genuine repeat failures
    // become a 503.
    let lastError = 'unknown';
    for (let attempt = 1; attempt <= 2; attempt++) {
      let raw: string;
      try {
        // chatOnce, not chat: this loop is already the retry, no need to
        // multiply attempts.
        raw = await this.chatOnce(messages, { ...opts, json: true });
      } catch (err) {
        // A provider-side json_validate_failed comes back as a non-2xx
        // and is thrown by chat() as a 503 — retry it rather than
        // bailing on the first try.
        lastError = err instanceof Error ? err.message : String(err);
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        lastError = `parse failed: ${raw.slice(0, 200)}`;
        continue;
      }
      if (validate(parsed)) return parsed;
      lastError = `wrong shape: ${raw.slice(0, 200)}`;
    }

    this.logger.error(`Groq JSON unusable after retry — ${lastError}`);
    throw new ServiceUnavailableException('AI returned an unexpected shape');
  }
}
