import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Difficulty } from '../entities/problem.entity';

export class GenerateProblemDto {
  // Reuse the same enum the entity/DB use — the generated problem is
  // persisted with this exact value, so validating against the enum here
  // means we never try to INSERT a difficulty Postgres would reject.
  @IsEnum(Difficulty)
  difficulty: Difficulty;

  // Free-text steer ("graphs", "dynamic programming", "string parsing").
  // Optional — without it the model picks a topic itself.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  topic?: string;
}
