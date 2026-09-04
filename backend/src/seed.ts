/**
 * Standalone seed script — `npm run seed` from backend/.
 *
 * createApplicationContext (not NestFactory.create) boots the DI
 * container WITHOUT an HTTP listener: we get the same repositories the
 * app uses, run some inserts, and exit. Nothing here is part of the
 * running server.
 *
 * Idempotent: each problem is keyed by its unique slug and skipped if it
 * already exists, so re-running never duplicates rows.
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { Problem, Difficulty } from './problems/entities/problem.entity';
import { TestCase } from './problems/entities/test-case.entity';

interface SeedTestCase {
  input: string;
  expectedOutput: string;
  isSample: boolean;
}

interface SeedProblem {
  title: string;
  slug: string;
  description: string;
  difficulty: Difficulty;
  testCases: SeedTestCase[];
}

// All problems are stdin -> stdout: the sandbox pipes `input` to the
// program's stdin and compares trimmed stdout to `expectedOutput`.
const PROBLEMS: SeedProblem[] = [
  {
    title: 'Sum of Two Integers',
    slug: 'sum-of-two-integers',
    difficulty: Difficulty.EASY,
    description:
      'Read a single line containing two space-separated integers `a` and `b` from standard input. Print their sum.\n\nExample: input `3 5` -> output `8`.',
    testCases: [
      { input: '3 5', expectedOutput: '8', isSample: true },
      { input: '-4 10', expectedOutput: '6', isSample: true },
      { input: '0 0', expectedOutput: '0', isSample: false },
      { input: '1000000 2000000', expectedOutput: '3000000', isSample: false },
    ],
  },
  {
    title: 'Reverse a String',
    slug: 'reverse-a-string',
    difficulty: Difficulty.EASY,
    description:
      'Read a single line of text from standard input and print it reversed.\n\nExample: input `hello` -> output `olleh`.',
    testCases: [
      { input: 'hello', expectedOutput: 'olleh', isSample: true },
      { input: 'racecar', expectedOutput: 'racecar', isSample: false },
      { input: 'AI Platform', expectedOutput: 'mroftalP IA', isSample: false },
    ],
  },
  {
    title: 'Count the Vowels',
    slug: 'count-the-vowels',
    difficulty: Difficulty.MEDIUM,
    description:
      'Read a single line of lowercase text from standard input. Print the number of vowels (`a`, `e`, `i`, `o`, `u`) it contains.\n\nExample: input `interview` -> output `4`.',
    testCases: [
      { input: 'interview', expectedOutput: '4', isSample: true },
      { input: 'rhythm', expectedOutput: '0', isSample: false },
      { input: 'aeiou', expectedOutput: '5', isSample: false },
      {
        input: 'the quick brown fox',
        expectedOutput: '5',
        isSample: false,
      },
    ],
  },
];

async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    // Pull the shared DataSource and open ONE transaction for the whole
    // seed — either every problem+testcase lands, or none does, so a
    // failure halfway can't leave a problem with no test cases.
    const dataSource = app.get(DataSource);
    await dataSource.transaction(async (manager) => {
      const problemRepo = manager.getRepository(Problem);
      const testCaseRepo = manager.getRepository(TestCase);

      for (const p of PROBLEMS) {
        const exists = await problemRepo.exists({ where: { slug: p.slug } });
        if (exists) {
          logger.log(`skip  ${p.slug} (already present)`);
          continue;
        }

        const problem = await problemRepo.save(
          problemRepo.create({
            title: p.title,
            slug: p.slug,
            description: p.description,
            difficulty: p.difficulty,
          }),
        );

        await testCaseRepo.save(
          p.testCases.map((tc) =>
            testCaseRepo.create({
              problemId: problem.id,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isSample: tc.isSample,
            }),
          ),
        );

        logger.log(`seed  ${p.slug} (${p.testCases.length} test cases)`);
      }
    });
  } finally {
    // Always close the DI container so the process can exit cleanly
    // (open TypeORM + Redis connections would otherwise keep it alive).
    await app.close();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    new Logger('Seed').error(err);
    process.exit(1);
  });
