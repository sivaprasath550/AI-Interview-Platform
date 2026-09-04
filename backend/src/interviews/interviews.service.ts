import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Interview,
  InterviewMessage,
  InterviewStatus,
  InterviewType,
} from './entities/interview.entity';
import { Problem } from '../problems/entities/problem.entity';
import { StartInterviewDto } from './dto/start-interview.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { GroqService, ChatMessage } from '../ai/groq.service';
import { EVALUATION_SYSTEM, interviewerSystem } from '../ai/prompts';

@Injectable()
export class InterviewsService {
  constructor(
    @InjectRepository(Interview)
    private readonly interviewRepo: Repository<Interview>,
    @InjectRepository(Problem)
    private readonly problemRepo: Repository<Problem>,
    private readonly groq: GroqService,
  ) {}

  async start(userId: string, dto: StartInterviewDto) {
    let problem: Problem | null = null;
    if (dto.type === InterviewType.CODING && dto.problemId) {
      problem = await this.problemRepo.findOne({
        where: { id: dto.problemId },
      });
      if (!problem) throw new NotFoundException('Problem not found');
    }

    const system = interviewerSystem(
      dto.type,
      problem
        ? {
            title: problem.title,
            difficulty: problem.difficulty,
            description: problem.description,
          }
        : undefined,
    );

    // Prime the conversation: no candidate turn yet, just ask the model
    // for its opening line given the system brief.
    const opening = await this.groq.chat(
      [
        { role: 'system', content: system },
        {
          role: 'user',
          content:
            'Begin the interview now with your opening message to the candidate.',
        },
      ],
      { temperature: 0.6, maxTokens: 400 },
    );

    const now = new Date().toISOString();
    const interview = this.interviewRepo.create({
      userId,
      type: dto.type,
      problemId: problem?.id ?? null,
      status: InterviewStatus.ACTIVE,
      messages: [{ role: 'interviewer', content: opening, at: now }],
      evaluation: null,
      endedAt: null,
    });
    const saved = await this.interviewRepo.save(interview);
    return this.toDto(saved, problem?.slug ?? null);
  }

  async listForUser(userId: string) {
    const rows = await this.interviewRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      turns: r.messages.length,
      hasEvaluation: r.evaluation != null,
      createdAt: r.createdAt,
      endedAt: r.endedAt,
    }));
  }

  async getForUser(id: string, userId: string) {
    const interview = await this.loadOwned(id, userId);
    const slug = interview.problemId
      ? ((
          await this.problemRepo.findOne({
            where: { id: interview.problemId },
            select: { slug: true },
          })
        )?.slug ?? null)
      : null;
    return this.toDto(interview, slug);
  }

  async sendMessage(id: string, userId: string, dto: SendMessageDto) {
    const interview = await this.loadOwned(id, userId);
    if (interview.status === InterviewStatus.ENDED) {
      throw new BadRequestException('This interview has already ended');
    }

    const candidateContent = dto.code?.trim()
      ? `${dto.content}\n\n\`\`\`python\n${dto.code}\n\`\`\``
      : dto.content;

    const candidateTurn: InterviewMessage = {
      role: 'candidate',
      content: candidateContent,
      at: new Date().toISOString(),
    };

    // Rebuild the full model context every turn: the system brief plus
    // the entire transcript translated to OpenAI roles. Stateless on the
    // provider side — WE own the conversation, the API just continues it.
    const modelMessages: ChatMessage[] = [
      { role: 'system', content: await this.systemFor(interview) },
      ...interview.messages.map(this.toChatMessage),
      this.toChatMessage(candidateTurn),
    ];

    const reply = await this.groq.chat(modelMessages, {
      temperature: 0.6,
      maxTokens: 500,
    });

    const interviewerTurn: InterviewMessage = {
      role: 'interviewer',
      content: reply,
      at: new Date().toISOString(),
    };

    interview.messages = [
      ...interview.messages,
      candidateTurn,
      interviewerTurn,
    ];
    await this.interviewRepo.save(interview);

    return { message: interviewerTurn, turns: interview.messages.length };
  }

  async end(id: string, userId: string) {
    const interview = await this.loadOwned(id, userId);
    if (interview.status === InterviewStatus.ENDED && interview.evaluation) {
      return interview.evaluation; // Idempotent — grading is done once.
    }

    const transcript = interview.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const evaluation = await this.groq.chatJson<Record<string, unknown>>(
      [
        { role: 'system', content: EVALUATION_SYSTEM },
        { role: 'user', content: `TRANSCRIPT:\n\n${transcript}` },
      ],
      (v): v is Record<string, unknown> =>
        typeof v === 'object' &&
        v !== null &&
        'scores' in v &&
        'recommendation' in v,
      { temperature: 0.2, maxTokens: 800 },
    );

    interview.status = InterviewStatus.ENDED;
    interview.endedAt = new Date();
    interview.evaluation = evaluation;
    await this.interviewRepo.save(interview);
    return evaluation;
  }

  // --- helpers -----------------------------------------------------------

  private async loadOwned(id: string, userId: string): Promise<Interview> {
    // Ownership in the WHERE clause — another user's interview is a 404,
    // never a 403, so ids can't be probed.
    const interview = await this.interviewRepo.findOne({
      where: { id, userId },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    return interview;
  }

  private async systemFor(interview: Interview): Promise<string> {
    // Rebuilt (not stored) so a prompt tweak applies to in-flight
    // sessions too. For pinned coding sessions we re-attach the problem
    // so the model stays anchored to it over a long conversation.
    let problem: Problem | undefined;
    if (interview.problemId) {
      problem =
        (await this.problemRepo.findOne({
          where: { id: interview.problemId },
        })) ?? undefined;
    }
    return interviewerSystem(
      interview.type,
      problem
        ? {
            title: problem.title,
            difficulty: problem.difficulty,
            description: problem.description,
          }
        : undefined,
    );
  }

  private toChatMessage = (m: InterviewMessage): ChatMessage => ({
    role: m.role === 'interviewer' ? 'assistant' : 'user',
    content: m.content,
  });

  private toDto(interview: Interview, problemSlug: string | null) {
    return {
      id: interview.id,
      type: interview.type,
      status: interview.status,
      problemSlug,
      messages: interview.messages,
      evaluation: interview.evaluation,
      createdAt: interview.createdAt,
      endedAt: interview.endedAt,
    };
  }
}
