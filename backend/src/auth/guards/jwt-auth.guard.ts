import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

// Step 5: a Guard runs BEFORE the Controller method, deciding whether the
// request is even allowed to proceed — this is where 401 gets thrown,
// before any business logic (or even the DTO validation pipe) runs.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or malformed Authorization header',
      );
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const payload = this.jwtService.verify<{ sub: string; email: string }>(
        token,
        { secret: this.configService.get<string>('JWT_ACCESS_SECRET') },
      );
      // Attaching the decoded payload to the request — this is what lets
      // a Controller method later read `req.user.sub` to know WHO is
      // making the request, without re-verifying the token itself.
      (request as Request & { user: typeof payload }).user = payload;
      return true;
    } catch {
      // Same reasoning as everywhere else in Step 7: don't distinguish
      // "expired" from "tampered/invalid" to the caller.
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
