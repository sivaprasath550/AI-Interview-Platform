import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { TestCase } from './test-case.entity';

// A real Postgres ENUM type, not a bare VARCHAR (the gap flagged back in
// Step 3) — the database itself now rejects an invalid value like
// "medim" at the INSERT, rather than relying on application code to
// catch every typo.
export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

@Entity('problems')
export class Problem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ unique: true })
  slug: string;

  @Column('text')
  description: string;

  @Column({ type: 'enum', enum: Difficulty })
  difficulty: Difficulty;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => TestCase, (testCase) => testCase.problem)
  testCases: TestCase[];
}
