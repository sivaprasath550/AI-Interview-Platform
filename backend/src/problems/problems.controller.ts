import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProblemsService } from './problems.service';
import { ListProblemsDto } from './dto/list-problems.dto';

@Controller('problems')
// Applied at the controller level — EVERY route in this controller
// requires a valid access token, matching Step 4's design ("Auth
// required? Yes, logged-in users only, for MVP").
@UseGuards(JwtAuthGuard)
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Get()
  findAll(@Query() query: ListProblemsDto) {
    return this.problemsService.findAll(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.problemsService.findBySlug(slug);
  }
}
