import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Problem, Difficulty } from './entities/problem.entity';
import { TestCase } from './entities/test-case.entity';
import { ListProblemsDto } from './dto/list-problems.dto';
import { HintDto } from './dto/hint.dto';
import { GenerateProblemDto } from './dto/generate-problem.dto';
import { SandboxService } from '../sandbox/sandbox.service';
import { GroqService } from '../ai/groq.service';
import {
  GENERATE_SYSTEM,
  generateUser,
  HINT_SYSTEM,
  hintUser,
} from '../ai/prompts';

// The shape we expect back from the problem-generation LLM call. Kept
// next to the type guard that enforces it.
interface GeneratedProblem {
  title: string;
  difficulty: Difficulty;
  description: string;
  reference_solution: string;
  test_cases: { input: string; expected_output: string; is_sample: boolean }[];
}

@Injectable()
export class ProblemsService {
  constructor(
    @InjectRepository(Problem)
    private readonly problemRepo: Repository<Problem>,
    @InjectRepository(TestCase)
    private readonly testCaseRepo: Repository<TestCase>,
    private readonly dataSource: DataSource,
    private readonly sandbox: SandboxService,
    private readonly groq: GroqService,
  ) {}

  async findAll(query: ListProblemsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // findAndCount: one call gets both the page of rows AND the total
    // count needed for pagination metadata — Step 4's response shape
    // (`{ data, pagination: { page, limit, total } }`) needs both.
    const [data, total] = await this.problemRepo.findAndCount({
      where: query.difficulty ? { difficulty: query.difficulty } : {},
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
      // Listing view deliberately omits `description` — a problem's full
      // text isn't needed to render a browse/list page, and skipping it
      // keeps the response smaller for what's likely the most-hit endpoint.
      // Object form, not a string array — this TypeORM version's
      // FindOptionsSelect type expects `{ column: true }` per field.
      select: {
        id: true,
        title: true,
        slug: true,
        difficulty: true,
        createdAt: true,
      },
    });

    return { data, pagination: { page, limit, total } };
  }

  async findBySlug(slug: string) {
    const problem = await this.problemRepo.findOne({ where: { slug } });
    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    // Only SAMPLE test cases go to the client. Hidden ones exist purely
    // for server-side grading (Step 3's is_sample flag) — sending them
    // here would let anyone view the full grading inputs/outputs simply
    // by inspecting the network tab, defeating their purpose entirely.
    const sampleTestCases = await this.testCaseRepo.find({
      where: { problemId: problem.id, isSample: true },
    });

    return { ...problem, testCases: sampleTestCases };
  }

  /**
   * A single coaching hint at the requested escalation level. Stateless —
   * nothing is stored; the prompt itself enforces "never a full solution".
   */
  async getHint(
    slug: string,
    dto: HintDto,
  ): Promise<{ level: number; hint: string }> {
    const problem = await this.problemRepo.findOne({ where: { slug } });
    if (!problem) throw new NotFoundException('Problem not found');

    return this.groq.chatJson<{ level: number; hint: string }>(
      [
        { role: 'system', content: HINT_SYSTEM },
        { role: 'user', content: hintUser(problem, dto.level, dto.code) },
      ],
      (v): v is { level: number; hint: string } =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as { hint?: unknown }).hint === 'string',
      // Fast model + a little warmth — hints are cheap, latency-sensitive,
      // and don't need the big model's rigour.
      { model: this.groq.models.fast, temperature: 0.5, maxTokens: 300 },
    );
  }

  /**
   * Generate a brand-new problem with an LLM, then PROVE it is valid by
   * running the model's own reference solution through the real sandbox
   * against the model's own test cases. Only a problem that passes every
   * case is persisted — this is what stops "AI-generated" from meaning
   * "unverified and possibly unsolvable".
   */
  async generate(dto: GenerateProblemDto) {
    // Two attempts: LLMs occasionally produce an off-by-a-newline
    // expected_output. One retry is a cheap way to absorb that without
    // making the user click again.
    for (let attempt = 1; attempt <= 2; attempt++) {
      const gen = await this.groq.chatJson<GeneratedProblem>(
        [
          { role: 'system', content: GENERATE_SYSTEM },
          { role: 'user', content: generateUser(dto.difficulty, dto.topic) },
        ],
        this.isGeneratedProblem,
        { temperature: 0.7, maxTokens: 2000 },
      );

      // Verify against the sandbox — the same runner real submissions use.
      const checks = await Promise.all(
        gen.test_cases.map(async (tc) => {
          const result = await this.sandbox.runPython(
            gen.reference_solution,
            tc.input,
          );
          return (
            !result.timedOut &&
            !result.stderr &&
            result.stdout.trim() === tc.expected_output.trim()
          );
        }),
      );

      if (checks.every(Boolean)) {
        return this.persistGenerated(gen);
      }
      // else: fall through and try once more
    }

    throw new UnprocessableEntityException(
      'Could not generate a verifiable problem right now — please try again.',
    );
  }

  private isGeneratedProblem = (v: unknown): v is GeneratedProblem => {
    if (typeof v !== 'object' || v === null) return false;
    const o = v as Record<string, unknown>;
    return (
      typeof o.title === 'string' &&
      typeof o.description === 'string' &&
      typeof o.reference_solution === 'string' &&
      ['easy', 'medium', 'hard'].includes(o.difficulty as string) &&
      Array.isArray(o.test_cases) &&
      o.test_cases.length > 0 &&
      o.test_cases.every(
        (t) =>
          typeof t === 'object' &&
          t !== null &&
          typeof (t as Record<string, unknown>).input === 'string' &&
          typeof (t as Record<string, unknown>).expected_output === 'string',
      )
    );
  };

  private async persistGenerated(gen: GeneratedProblem) {
    const slug = await this.uniqueSlug(this.slugify(gen.title));

    // One transaction: a problem with no test cases is useless, so it's
    // all-or-nothing.
    return this.dataSource.transaction(async (manager) => {
      const problemRepo = manager.getRepository(Problem);
      const testCaseRepo = manager.getRepository(TestCase);

      const problem = await problemRepo.save(
        problemRepo.create({
          title: gen.title,
          slug,
          description: gen.description,
          difficulty: gen.difficulty,
        }),
      );
      await testCaseRepo.save(
        gen.test_cases.map((tc) =>
          testCaseRepo.create({
            problemId: problem.id,
            input: tc.input,
            expectedOutput: tc.expected_output,
            isSample: tc.is_sample,
          }),
        ),
      );
      return {
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty,
      };
    });
  }

  private slugify(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60);
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base || 'problem';
    let n = 2;
    // `slug` is UNIQUE in the DB; loop until we find a free one so
    // generating two "Two Sum" variants doesn't 500 on the constraint.
    while (await this.problemRepo.exists({ where: { slug: candidate } })) {
      candidate = `${base}-${n++}`;
    }
    return candidate;
  }
}
