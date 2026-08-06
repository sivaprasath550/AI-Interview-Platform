import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    UsersModule,
    // Registering RefreshToken here (not in UsersModule) — it's an
    // auth-flow concern, not core user data, matching the module
    // boundary reasoning from Step 5/6: each module owns one cohesive
    // slice of responsibility.
    TypeOrmModule.forFeature([RefreshToken]),
    // JwtModule.register({}) with no global secret/expiry — we pass
    // secret + expiresIn explicitly per-call in AuthService instead,
    // since access and refresh tokens each need their OWN secret
    // (Step 7: never share signing keys between the two).
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  // Exporting JwtModule + JwtAuthGuard: any OTHER module (Problems,
  // Submissions, ...) that wants to protect its routes just imports
  // AuthModule and can use @UseGuards(JwtAuthGuard) — without this
  // export, those modules' own DI containers wouldn't have JwtService
  // available to construct the guard.
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
