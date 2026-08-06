import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Difficulty } from '../entities/problem.entity';

export class ListProblemsDto {
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  // @Type(() => Number): tells class-transformer HOW to convert the raw
  // query string into the type this field actually is — paired with
  // ValidationPipe's `transform: true` (main.ts) to make @IsInt() below
  // check the CONVERTED number, not the original string.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
