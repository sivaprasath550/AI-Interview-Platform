import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Problem } from '../../problems/entities/problem.entity';

export enum InterviewType {
  CODING = 'coding',
  BEHAVIORAL = 'behavioral',
  SYSTEM_DESIGN = 'system_design',
}

export enum InterviewStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
}

// One transcript turn. `role` is our domain vocabulary
// (interviewer/candidate); it is mapped to OpenAI's assistant/user roles
// only at the moment we call the model.
export interface InterviewMessage {
  role: 'interviewer' | 'candidate';
  content: string;
  at: string; // ISO timestamp
}

@Entity('interviews')
export class Interview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: InterviewType })
  type: InterviewType;

  // Only set for coding interviews that are pinned to a specific problem.
  // Nullable + ON DELETE SET NULL: deleting a problem shouldn't destroy
  // the interview transcripts that referenced it.
  @ManyToOne(() => Problem, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'problem_id' })
  problem: Problem | null;

  @Column({ name: 'problem_id', nullable: true })
  problemId: string | null;

  @Column({
    type: 'enum',
    enum: InterviewStatus,
    default: InterviewStatus.ACTIVE,
  })
  status: InterviewStatus;

  // The whole conversation, appended to on every turn. jsonb so Postgres
  // stores it compactly and validates it's real JSON. The alternative —
  // a `messages` child table — buys queryability we don't need and costs
  // a join on every read; a chat transcript is only ever loaded whole.
  @Column({ type: 'jsonb', default: [] })
  messages: InterviewMessage[];

  // The structured post-interview evaluation. NULL until the candidate
  // ends the session.
  @Column({ type: 'jsonb', nullable: true })
  evaluation: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;
}
