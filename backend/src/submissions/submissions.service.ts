import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { Submission, SubmissionStatus } from './entities/submission.entity';
import { Problem } from '../problems/entities/problem.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { GroqService } from '../ai/groq.service';
import { FEEDBACK_SYSTEM, feedbackUser } from '../ai/prompts';

// The producer half of the queue. This service does the *fast* work
// synchronously inside the HTTP request (validate, write a row, enqueue a
// job) and hands the *slow* work (spinning up Docker containers per test
// case) off to ExecutionProcessor, which runs outside the request cycle.
// That split is the whole reason POST /submissions can answer in
// milliseconds with 202 instead of blocking the client for seconds.
@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    // We only need Problem here to answer one question — "does this
    // problemId actually exist?" — so a 404 is raised in the request,
    // not swallowed later inside a background job the client can't see.
    @InjectRepository(Problem)
    private readonly problemRepo: Repository<Problem>,
    // 'execution' matches BullModule.registerQueue({ name: 'execution' })
    // in submissions.module.ts AND @Processor('execution') on the worker.
    // All three strings must agree or jobs are added to a queue nobody
    // is listening on.
    @InjectQueue('execution')
    private readonly executionQueue: Queue,
    private readonly groq: GroqService,
  ) {}

  async create(
    userId: string,
    dto: CreateSubmissionDto,
  ): Promise<{ id: string; status: SubmissionStatus }> {
    // exists() over findOne() — we don't need the row's contents, just a
    // yes/no, and this lets Postgres answer with a cheaper query.
    const problemExists = await this.problemRepo.exists({
      where: { id: dto.problemId },
    });
    if (!problemExists) {
      throw new NotFoundException('Problem not found');
    }

    // userId comes from the verified JWT (req.user.sub), never from the
    // request body — a client cannot submit code "as" another user by
    // sending someone else's id. Same principle as the ownership-scoped
    // read below.
    const submission = this.submissionRepo.create({
      userId,
      problemId: dto.problemId,
      code: dto.code,
      language: dto.language,
      status: SubmissionStatus.PENDING,
    });
    const saved = await this.submissionRepo.save(submission);

    // The job payload is deliberately just the id, not the whole
    // submission. The row is the single source of truth; the worker
    // re-reads it. Passing the code through Redis too would mean two
    // copies that can drift, and a fat payload in every queue entry.
    await this.executionQueue.add(
      'execute',
      { submissionId: saved.id },
      {
        // One attempt only — re-running arbitrary user code on a
        // transient failure risks double-charging CPU for no benefit;
        // the submission simply lands in ERROR and the user resubmits.
        attempts: 1,
        // Keep the queue from growing without bound in Redis once jobs
        // finish — the submission row, not the job, is what we keep.
        removeOnComplete: 200,
        removeOnFail: 200,
      },
    );

    return { id: saved.id, status: saved.status };
  }

  async findOneForUser(id: string, userId: string): Promise<Submission> {
    // Ownership is enforced in the WHERE clause, not as an if-check after
    // fetching. A submission belonging to another user is indistinguishable
    // here from one that doesn't exist — the caller gets an identical 404
    // either way, so this endpoint can't be used to probe which ids are
    // real.
    const submission = await this.submissionRepo.findOne({
      where: { id, userId },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    return submission;
  }

  /**
   * AI code-review for one submission. Generated lazily and cached on the
   * row: the code is immutable after grading, so a second request just
   * returns the stored `aiFeedback` without another paid LLM call.
   */
  async getFeedback(
    id: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const submission = await this.findOneForUser(id, userId);

    if (submission.aiFeedback) {
      return submission.aiFeedback;
    }

    // Only meaningful once the judge has actually run — feedback on a
    // still-PENDING submission would have no verdict to explain.
    if (
      submission.status === SubmissionStatus.PENDING ||
      submission.status === SubmissionStatus.RUNNING
    ) {
      throw new BadRequestException('Submission is still being graded');
    }

    const problem = await this.problemRepo.findOne({
      where: { id: submission.problemId },
    });
    if (!problem) throw new NotFoundException('Problem not found');

    const feedback = await this.groq.chatJson<Record<string, unknown>>(
      [
        { role: 'system', content: FEEDBACK_SYSTEM },
        {
          role: 'user',
          content: feedbackUser(
            problem,
            submission.code,
            submission.status,
            submission.runtimeMs,
          ),
        },
      ],
      // Minimal shape check — the prompt asks for these keys; if the model
      // drifts, chatJson turns it into a 503 rather than a broken UI.
      (v): v is Record<string, unknown> =>
        typeof v === 'object' &&
        v !== null &&
        'correctness' in v &&
        'suggestions' in v,
      { temperature: 0.3, maxTokens: 900 },
    );

    submission.aiFeedback = feedback;
    await this.submissionRepo.save(submission);
    return feedback;
  }
}
