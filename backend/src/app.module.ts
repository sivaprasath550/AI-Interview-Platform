import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { ProblemsModule } from './problems/problems.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { InterviewsModule } from './interviews/interviews.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
      }),
    }),
    // BullModule.forRootAsync — the ONE place the Redis connection is
    // configured. Every BullModule.registerQueue(...) elsewhere reuses
    // this connection instead of each opening its own.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          // Number(...) because ConfigService returns raw strings from
          // .env; ioredis wants a numeric port.
          port: Number(config.get<string>('REDIS_PORT')),
        },
      }),
    }),
    // @Global infrastructure modules — imported once here, injectable
    // everywhere: RedisModule (shared ioredis client) and AiModule
    // (GroqService + AiRateLimitGuard).
    RedisModule,
    AiModule,
    // Registering AuthModule here is the last wiring step — this is what
    // makes POST /auth/signup actually exist as a route in the running app.
    AuthModule,
    ProblemsModule,
    SubmissionsModule,
    InterviewsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
