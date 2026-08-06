import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { Submission, SubmissionStatus } from './entities/submission.entity';
import { TestCase } from '../problems/entities/test-case.entity';
import { SandboxService } from './sandbox/sandbox.service';

interface ExecutionJobData {
  submissionId: string;
}

// @Processor('execution') pairs with BullModule.registerQueue({ name:
// 'execution' }) in submissions.module.ts — this class IS the worker
// (consumer) side of the queue; SubmissionsService.create() is the
// producer side that adds jobs to it.
@Processor('execution')
export class ExecutionProcessor extends WorkerHost {
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
  }
}
