import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Problem } from '../../problems/entities/problem.entity';

export enum SubmissionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  ERROR = 'error',
}

// Only one supported value for now (Python) — a real enum, not a bare
// string, so adding a second language later is a deliberate schema
// change, not an unvalidated free-text field.
export enum SubmissionLanguage {
  PYTHON = 'python',
}

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Same @JoinColumn pattern as TestCase.problem — one physical column
  // (`user_id`) serving both the relation object and a plain scalar id,
  // learned from the bug we caught earlier this module.
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Problem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;

  @Column({ name: 'problem_id' })
  problemId: string;

  @Column('text')
  code: string;

  @Column({ type: 'enum', enum: SubmissionLanguage })
  language: SubmissionLanguage;

  @Column({
    type: 'enum',
    enum: SubmissionStatus,
    default: SubmissionStatus.PENDING,
  })
  status: SubmissionStatus;

  // Nullable — unknown until execution finishes. Step 3: NULL here
  // means "not measured yet," never coerce this to 0.
  @Column({ name: 'runtime_ms', type: 'int', nullable: true })
  runtimeMs: number | null;

  // Cached AI code-review, generated on demand by POST
  // /submissions/:id/feedback. jsonb (not text) so Postgres validates
  // it's well-formed JSON on write and we can query into it later if we
  // ever want to. NULL = "not requested yet"; the LLM call is only made
  // once per submission and reused afterwards, since it costs tokens and
  // the code never changes after grading.
  @Column({ name: 'ai_feedback', type: 'jsonb', nullable: true })
  aiFeedback: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
