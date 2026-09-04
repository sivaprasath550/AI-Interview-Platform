import { Module } from '@nestjs/common';
import { SandboxService } from './sandbox.service';

// Pulled out of SubmissionsModule so it can be shared: the submissions
// worker runs user code against a problem's tests, and problem
// GENERATION runs an AI-written reference solution against AI-written
// tests to prove the generated problem is actually correct. Same
// primitive, two callers.
@Module({
  providers: [SandboxService],
  exports: [SandboxService],
})
export class SandboxModule {}
