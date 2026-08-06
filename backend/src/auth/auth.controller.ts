import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
// `import type` — Response/Request are used only as type annotations
// below, never as values. With isolatedModules on, TS needs that
// distinction explicit so it can safely strip these imports when
// compiling this file.
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

const REFRESH_COOKIE_NAME = 'refreshToken';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const currentToken = req.cookies?.[REFRESH_COOKIE_NAME] as
      | string
      | undefined;
    const { accessToken, refreshToken, user } =
      await this.authService.refresh(currentToken);
    // Rotation means we always set a NEW cookie here, overwriting the
    // one that was just single-use-consumed by authService.refresh().
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const currentToken = req.cookies?.[REFRESH_COOKIE_NAME] as
      | string
      | undefined;
    await this.authService.logout(currentToken);
    // clearCookie needs the same path the cookie was originally set
    // with (default '/') to actually match and remove it — mismatched
    // options here is a common reason "logout" appears to do nothing.
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    // Step 7: HttpOnly (JS can't read it, defends against XSS
    // exfiltration), SameSite=Strict (browser won't attach it to
    // cross-site requests, defends against CSRF), secure:false only
    // because local dev is plain http:// — this MUST be true in
    // production or the cookie could travel over an unencrypted
    // connection.
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, in milliseconds
    });
  }
}
