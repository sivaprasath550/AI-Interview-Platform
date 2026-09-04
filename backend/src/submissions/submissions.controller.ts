import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiRateLimitGuard } from '../ai/ai-rate-limit.guard';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

// The shape JwtAuthGuard attaches to the request after it verifies the
// access token. Declared here rather than imported so the controller
// depends on the *contract* (there's a user with a sub claim), not on the
// guard's internals.
type AuthedRequest = Request & { user: { sub: string; email: string } };

@Controller('submissions')
// Every route here is logged-in-only. The guard runs before the handler,
// so by the time any method below executes, req.user.sub is guaranteed
// to be a real, verified user id.
@UseGuards(JwtAuthGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  // 202 Accepted, not 201 Created: the work isn't done when we respond.
  // We've *accepted* the code for grading and will process it out of
  // band — the client is expected to poll GET /submissions/:id for the
  // outcome. 200/201 would imply the result in this response is final.
  @HttpCode(HttpStatus.ACCEPTED)
  async create(@Req() req: AuthedRequest, @Body() dto: CreateSubmissionDto) {
    return this.submissionsService.create(req.user.sub, dto);
  }

  @Get(':id')
  async findOne(
    @Req() req: AuthedRequest,
    // ParseUUIDPipe rejects a malformed id with 400 before we ever hit
    // the database with a garbage value — and keeps the "not found vs.
    // not yours" response identical for every *well-formed* id.
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const submission = await this.submissionsService.findOneForUser(
      id,
      req.user.sub,
    );
    // Return a deliberate projection, not the raw entity. The client
    // polling for a result needs status/runtime, not its own code echoed
    // back on every poll, and definitely not the relation objects.
    return {
      id: submission.id,
      problemId: submission.problemId,
      language: submission.language,
      status: submission.status,
      runtimeMs: submission.runtimeMs,
      hasAiFeedback: submission.aiFeedback != null,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    };
  }

  @Post(':id/feedback')
  @HttpCode(HttpStatus.OK)
  // Stack a second guard on just this route: JwtAuthGuard (controller
  // level) still runs first and populates req.user; AiRateLimitGuard then
  // meters the paid LLM call per user.
  @UseGuards(AiRateLimitGuard)
  async feedback(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const feedback = await this.submissionsService.getFeedback(
      id,
      req.user.sub,
    );
    return { feedback };
  }
}
