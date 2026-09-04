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
import { InterviewsService } from './interviews.service';
import { StartInterviewDto } from './dto/start-interview.dto';
import { SendMessageDto } from './dto/send-message.dto';

type AuthedRequest = Request & { user: { sub: string; email: string } };

@Controller('interviews')
@UseGuards(JwtAuthGuard)
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  // AiRateLimitGuard on every write route — each one triggers a model
  // call. GET routes just read the transcript from Postgres, so they're
  // left unmetered.
  @UseGuards(AiRateLimitGuard)
  start(@Req() req: AuthedRequest, @Body() dto: StartInterviewDto) {
    return this.interviews.start(req.user.sub, dto);
  }

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.interviews.listForUser(req.user.sub);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.interviews.getForUser(id, req.user.sub);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiRateLimitGuard)
  sendMessage(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.interviews.sendMessage(id, req.user.sub, dto);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AiRateLimitGuard)
  async end(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    const evaluation = await this.interviews.end(id, req.user.sub);
    return { evaluation };
  }
}
