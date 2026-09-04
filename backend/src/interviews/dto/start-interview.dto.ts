import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { InterviewType } from '../entities/interview.entity';

export class StartInterviewDto {
  @IsEnum(InterviewType)
  type: InterviewType;

  // Optional, and only used for `type: coding`. If given, the interviewer
  // is briefed on this exact problem; if omitted, the model picks one.
  @IsOptional()
  @IsUUID()
  problemId?: string;
}
