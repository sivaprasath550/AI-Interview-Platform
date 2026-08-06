import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Problem } from './entities/problem.entity';
import { TestCase } from './entities/test-case.entity';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';

@Module({
  imports: [
    // AuthModule — needed for JwtAuthGuard (which itself needs JwtService,
    // exported from AuthModule) to be constructible in THIS module's DI
    // container, not just AuthModule's own.
    AuthModule,
    TypeOrmModule.forFeature([Problem, TestCase]),
  ],
  controllers: [ProblemsController],
  providers: [ProblemsService],
})
export class ProblemsModule {}
