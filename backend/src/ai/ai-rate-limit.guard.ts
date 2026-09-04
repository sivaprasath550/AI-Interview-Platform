import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

// Every AI route costs a real upstream API call (tokens = money + shared
// rate limit). This guard caps how many an individual user can make per
// rolling minute so one person can't burn the whole Groq quota — applied
// AFTER JwtAuthGuard, so req.user.sub is already populated.
//
// Algorithm: fixed-window counter. `INCR` a per-user-per-minute key and
// set a TTL the first time we create it. Simple, atomic on the Redis
// side, and good enough here; a sliding-window or token-bucket would be
// the upgrade if bursts at window boundaries ever mattered.
// A live interview makes one call per turn, and a user may also be
// pulling hints / feedback in the same minute — so this is generous
// enough not to interrupt normal use, while still stopping a script from
// running the token bill up.
const MAX_REQUESTS_PER_MINUTE = 30;

@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(AiRateLimitGuard.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { sub: string } }>();
    const userId = req.user?.sub;
    if (!userId) return true; // No identity to meter — JwtAuthGuard will reject anyway.

    const windowKey = `ai:rl:${userId}:${Math.floor(Date.now() / 60_000)}`;

    let count: number;
    try {
      count = await this.redis.incr(windowKey);
      if (count === 1) {
        // First hit in this window — arm the TTL so the key self-cleans.
        await this.redis.expire(windowKey, 60);
      }
    } catch (err) {
      // If Redis is unreachable we FAIL OPEN: a metering outage should
      // not take down the AI features entirely. The upstream provider's
      // own rate limit is still a backstop.
      this.logger.warn(
        `rate-limit check skipped (redis error): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return true;
    }

    if (count > MAX_REQUESTS_PER_MINUTE) {
      throw new HttpException(
        `Too many AI requests. Limit is ${MAX_REQUESTS_PER_MINUTE}/minute — try again shortly.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
