import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiRateLimitGuard } from '../ai/ai-rate-limit.guard';
import { ProblemsService } from './problems.service';
import { ListProblemsDto } from './dto/list-problems.dto';
import { HintDto } from './dto/hint.dto';
import { GenerateProblemDto } from './dto/generate-problem.dto';

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

  // Declared before the `:slug` routes so the literal path "generate" is
  // matched here and never treated as a slug.
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AiRateLimitGuard)
  generate(@Body() dto: GenerateProblemDto) {
    return this.problemsService.generate(dto);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.problemsService.findBySlug(slug);
  }

  @Post(':slug/hint')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiRateLimitGuard)
  hint(@Param('slug') slug: string, @Body() dto: HintDto) {
    return this.problemsService.getHint(slug, dto);
  }
}
