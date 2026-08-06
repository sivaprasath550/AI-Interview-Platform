import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Problem } from './entities/problem.entity';
import { TestCase } from './entities/test-case.entity';
import { ListProblemsDto } from './dto/list-problems.dto';

@Injectable()
export class ProblemsService {
  constructor(
    @InjectRepository(Problem)
    private readonly problemRepo: Repository<Problem>,
    @InjectRepository(TestCase)
    private readonly testCaseRepo: Repository<TestCase>,
  ) {}

  async findAll(query: ListProblemsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // findAndCount: one call gets both the page of rows AND the total
    // count needed for pagination metadata — Step 4's response shape
    // (`{ data, pagination: { page, limit, total } }`) needs both.
    const [data, total] = await this.problemRepo.findAndCount({
      where: query.difficulty ? { difficulty: query.difficulty } : {},
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
      // Listing view deliberately omits `description` — a problem's full
      // text isn't needed to render a browse/list page, and skipping it
      // keeps the response smaller for what's likely the most-hit endpoint.
      // Object form, not a string array — this TypeORM version's
      // FindOptionsSelect type expects `{ column: true }` per field.
      select: { id: true, title: true, slug: true, difficulty: true, createdAt: true },
    });

    return { data, pagination: { page, limit, total } };
  }

  async findBySlug(slug: string) {
    const problem = await this.problemRepo.findOne({ where: { slug } });
    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    // Only SAMPLE test cases go to the client. Hidden ones exist purely
    // for server-side grading (Step 3's is_sample flag) — sending them
    // here would let anyone view the full grading inputs/outputs simply
    // by inspecting the network tab, defeating their purpose entirely.
    const sampleTestCases = await this.testCaseRepo.find({
      where: { problemId: problem.id, isSample: true },
    });

    return { ...problem, testCases: sampleTestCases };
  }
}
