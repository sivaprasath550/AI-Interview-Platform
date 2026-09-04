import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  // The candidate's spoken/typed turn. Bounded so one request can't shove
  // a novel into the context window.
  @IsString()
  @MinLength(1)
  @MaxLength(6000)
  content: string;

  // Optional code buffer (coding interviews). Appended to the message as
  // a fenced block so the interviewer model sees exactly what the
  // candidate is looking at.
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  code?: string;
}
