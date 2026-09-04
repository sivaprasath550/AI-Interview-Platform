import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { Submission, SubmissionStatus } from './entities/submission.entity';
import { TestCase } from '../problems/entities/test-case.entity';
import { SandboxService } from '../sandbox/sandbox.service';

interface ExecutionJobData {
  submissionId: string;
}

// @Processor('execution') pairs with BullModule.registerQueue({ name:
// 'execution' }) in submissions.module.ts — this class IS the worker
// (consumer) side of the queue; SubmissionsService.create() is the
// producer side that adds jobs to it.
@Processor('execution')
export class ExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(ExecutionProcessor.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(TestCase)
    private readonly testCaseRepo: Repository<TestCase>,
    private readonly sandboxService: SandboxService,
  ) {
    super();
  }

  async process(job: Job<ExecutionJobData>): Promise<void> {
    const submission = await this.submissionRepo.findOne({
      where: { id: job.data.submissionId },
    });
    if (!submission) return; // Row is gone — nothing to do.

    submission.status = SubmissionStatus.RUNNING;
    await this.submissionRepo.save(submission);

    try {
      // ALL test cases, not just samples — grading must check the hidden
      // ones too. Only the /problems/:slug READ endpoint hides them from
      // the client; the worker needs the full set.
      const testCases = await this.testCaseRepo.find({
        where: { problemId: submission.problemId },
      });

      const startedAt = Date.now();
      let allPassed = true;
      let hadError = false;

      for (const testCase of testCases) {
        const result = await this.sandboxService.runPython(
          submission.code,
          testCase.input,
        );

        if (result.timedOut || result.stderr) {
          hadError = true;
          break;
        }
        // .trim() on both sides — a trailing newline shouldn't fail an
        // otherwise-correct submission. A common real gotcha in judges.
        if (result.stdout.trim() !== testCase.expectedOutput.trim()) {
          allPassed = false;
          break;
        }
      }

      submission.runtimeMs = Date.now() - startedAt;
      submission.status = hadError
        ? SubmissionStatus.ERROR
        : allPassed
          ? SubmissionStatus.PASSED
          : SubmissionStatus.FAILED;

      await this.submissionRepo.save(submission);
    } catch (err) {
      // Anything the grading loop itself can't handle — Docker daemon
      // down, image missing, a dockerode error — must not leave the row
      // stuck in RUNNING forever (the client would poll indefinitely).
      // Land it in ERROR, which is a terminal state, and log the real
      // cause for us. We swallow rather than rethrow: attempts:1 means a
      // rethrow just moves the job to "failed" with the same user-visible
      // result, minus the clean status write.
      this.logger.error(
        `Submission ${submission.id} failed to execute: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      submission.status = SubmissionStatus.ERROR;
      await this.submissionRepo.save(submission);
    }
  }
}
