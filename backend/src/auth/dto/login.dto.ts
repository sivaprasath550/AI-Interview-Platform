import { IsEmail, IsString } from 'class-validator';

// Deliberately NOT reusing SignupDto here even though both have
// email/password — login doesn't need @MinLength(8) (we're checking
// an existing password, not enforcing a policy on a new one), and
// keeping them separate means changing signup's password rules later
// can't accidentally break login's validation.
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
