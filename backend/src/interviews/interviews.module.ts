import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Interview } from './entities/interview.entity';
import { Problem } from '../problems/entities/problem.entity';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';

@Module({
  imports: [
    AuthModule,
    // Interview is owned here; Problem is read-only (to brief the
    // interviewer on a pinned coding problem). AiModule + RedisModule
    // are @Global.
    TypeOrmModule.forFeature([Interview, Problem]),
  ],
  controllers: [InterviewsController],
  providers: [InterviewsService],
})
export class InterviewsModule {}
