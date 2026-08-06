import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Problem } from './problem.entity';

@Entity('test_cases')
export class TestCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Without @JoinColumn, TypeORM creates its OWN implicit join column
  // (named after the relation property, "problemId") completely separate
  // from the plain `problemId` @Column below — resulting in two
  // foreign-key-shaped columns on one table, only one of which is a real,
  // typed, constrained FK. @JoinColumn({ name: 'problem_id' }) tells
  // TypeORM "this relation's FK IS the problem_id column below," not a
  // second one — this is the standard pattern for having both a full
  // relation object (`.problem`) and a plain scalar id (`.problemId`)
  // that refer to the exact same physical column.
  @ManyToOne(() => Problem, (problem) => problem.testCases, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'problem_id' })
  problem: Problem;

  @Column({ name: 'problem_id' })
  problemId: string;

  @Column('text')
  input: string;

  @Column({ name: 'expected_output', type: 'text' })
  expectedOutput: string;

  // Distinguishes test cases shown to the user (examples on the problem
  // page) from hidden ones used only for grading — Step 3's reasoning
  // for why this is a real column, not something bolted on later.
  @Column({ name: 'is_sample', default: false })
  isSample: boolean;
}
