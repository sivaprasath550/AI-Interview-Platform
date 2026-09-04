import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { SandboxModule } from '../sandbox/sandbox.module';
import { Problem } from '../problems/entities/problem.entity';
import { TestCase } from '../problems/entities/test-case.entity';
import { Submission } from './entities/submission.entity';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { ExecutionProcessor } from './execution.processor';

@Module({
  imports: [
    // For JwtAuthGuard (needs JwtService, exported by AuthModule) to be
    // constructible in this module's DI container.
    AuthModule,
    // The Docker code-runner, now shared with problem generation.
    SandboxModule,
    // Submission is owned by this module; Problem + TestCase are borrowed
    // read-only — the service checks a problem exists, the worker reads
    // the full (including hidden) test-case set to grade against.
    TypeOrmModule.forFeature([Submission, Problem, TestCase]),
    // Names the 'execution' queue for THIS module. forRoot in AppModule
    // supplies the Redis connection; this line is what makes
    // @InjectQueue('execution') (producer) and @Processor('execution')
    // (consumer) resolve to the same queue.
    BullModule.registerQueue({ name: 'execution' }),
  ],
  controllers: [SubmissionsController],
  // ExecutionProcessor is a provider like any other — @nestjs/bullmq
  // sees the @Processor decorator and wires it up as a BullMQ Worker on
  // module init.
  providers: [SubmissionsService, ExecutionProcessor],
})
export class SubmissionsModule {}
