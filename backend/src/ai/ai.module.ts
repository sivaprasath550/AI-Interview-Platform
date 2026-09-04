import { Global, Module } from '@nestjs/common';
import { GroqService } from './groq.service';
import { AiRateLimitGuard } from './ai-rate-limit.guard';

// @Global: GroqService is a leaf dependency with no state of its own that
// several feature modules (submissions, problems, interviews) all need.
// Making it global avoids re-importing AiModule in each of them, the same
// call we made for RedisModule.
@Global()
@Module({
  providers: [GroqService, AiRateLimitGuard],
  exports: [GroqService, AiRateLimitGuard],
})
export class AiModule {}
