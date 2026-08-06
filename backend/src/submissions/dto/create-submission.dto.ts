import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { SubmissionLanguage } from '../entities/submission.entity';

export class CreateSubmissionDto {
  @IsUUID()
  problemId: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEnum(SubmissionLanguage)
  language: SubmissionLanguage;
}
