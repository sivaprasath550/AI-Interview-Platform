import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class HintDto {
  // 1 = conceptual nudge, 2 = name the approach, 3 = step-by-step outline.
  // Bounded on both ends so a client can't ask for "level 99" and coax
  // the model past the "never a full solution" instruction.
  @IsInt()
  @Min(1)
  @Max(3)
  level: number;

  // Optional: the code the candidate has so far, so the hint can react to
  // where they actually are. Capped so a giant paste can't blow up the
  // prompt (and the token bill).
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  code?: string;
}
