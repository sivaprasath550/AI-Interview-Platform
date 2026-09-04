import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// A single shared ioredis connection, injectable anywhere as
// @Inject(REDIS_CLIENT). BullMQ manages its own pool internally; this one
// is for everything else we want Redis for (here: AI rate-limit counters).
// @Global so feature modules don't each have to import RedisModule.
export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get<string>('REDIS_PORT', '6379')),
          // Fail fast instead of buffering commands forever if Redis is
          // down — a rate-limit check should degrade quickly, not hang
          // the request it's guarding.
          maxRetriesPerRequest: 2,
          enableOfflineQueue: false,
        });
        client.on('error', () => {
          /* ioredis logs its own reconnect attempts; swallow to avoid noise */
        });
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
