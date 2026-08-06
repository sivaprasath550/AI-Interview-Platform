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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
