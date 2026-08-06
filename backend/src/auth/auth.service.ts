import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });
    const saved = await this.userRepo.save(user);

    const { passwordHash: _omit, ...safeUser } = saved;
    return safeUser;
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<User, 'passwordHash'>;
  }> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });

    // Deliberately the SAME error, same status, whether the email doesn't
    // exist OR the password is wrong (Step 4: prevents attackers from using
    // this endpoint to enumerate which emails have accounts).
    const invalidCredentials = () =>
      new UnauthorizedException('Invalid email or password');

    if (!user) throw invalidCredentials();

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) throw invalidCredentials();

    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user);

    // Returning user info alongside the tokens — same reasoning as
    // signup: the frontend needs to know WHO just logged in (name, email)
    // to populate its auth store, without a second round-trip request.
    // passwordHash stripped, same as signup's response.
    const { passwordHash: _omit, ...safeUser } = user;

    return { accessToken, refreshToken, user: safeUser };
  }

  async refresh(rawToken: string | undefined): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<User, 'passwordHash'>;
  }> {
    if (!rawToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    let payload: { sub: string };
    try {
      payload = this.jwtService.verify<{ sub: string }>(rawToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      // Covers both an expired token (exp claim) and a tampered/invalid
      // signature — verify() throws for both, and we don't distinguish
      // them to the caller (same anti-enumeration reasoning as login's
      // single generic error message, Step 4).
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash },
    });

    if (!stored || stored.userId !== payload.sub) {
      // The signature verified fine — this token WAS legitimately issued
      // by us at some point — but it's no longer in the table, meaning
      // it was already rotated away by a previous refresh, or revoked by
      // a logout. Someone presenting a refresh token that shouldn't be
      // usable anymore is a strong signal of a stolen, replayed token.
      // Defensive response: revoke EVERY refresh token this user
      // currently holds, forcing re-login on all devices, not just this
      // one — better to inconvenience the legitimate user than let a
      // suspected-stolen token keep working elsewhere.
      await this.refreshTokenRepo.delete({ userId: payload.sub });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotation: delete the token we just used BEFORE issuing a new one.
    // A refresh token should only ever work once — if we didn't rotate,
    // a stolen refresh token would stay valid and reusable for its
    // entire 7-day life. With rotation, using it here immediately
    // invalidates it, so a copy an attacker stole earlier stops working
    // the moment the legitimate user's browser refreshes normally — and
    // if the ATTACKER'S copy gets used first, the check above catches
    // the legitimate user's later attempt as "already used" and revokes
    // everything, surfacing the compromise instead of staying silent.
    await this.refreshTokenRepo.delete({ id: stored.id });

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User no longer exists');

    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user);
    const { passwordHash: _omit, ...safeUser } = user;

    return { accessToken, refreshToken, user: safeUser };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return; // Nothing to revoke — already logged out.
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    // Best-effort: if it's already expired/rotated/gone, there's simply
    // nothing left to revoke, which is fine.
    await this.refreshTokenRepo.delete({ tokenHash });
  }

  private signAccessToken(user: User): string {
    // The JWT payload — Step 7: only non-sensitive, low-stakes claims here.
    // We deliberately do NOT put `role` in here for anything authorization-
    // critical, precisely because of the staleness problem we covered
    // (a revoked/changed role wouldn't take effect until this token expires).
    const payload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      // expiresIn takes seconds (a plain number) here instead of a string
      // like "15m" — @nestjs/jwt's string form uses a strict template-
      // literal type from the `ms` package that TypeScript can't verify
      // against a value loaded dynamically from .env at runtime. Seconds
      // sidesteps that friction entirely and is unambiguous either way.
      expiresIn: this.parseExpiryToSeconds(
        this.configService.get<string>('JWT_ACCESS_EXPIRY') ?? '15m',
      ),
    });
  }

  private async issueRefreshToken(user: User): Promise<string> {
    const refreshExpirySeconds = this.parseExpiryToSeconds(
      this.configService.get<string>('JWT_REFRESH_EXPIRY') ?? '7d',
    );

    // jti (JWT ID): a random unique identifier per token, an RFC 7519-
    // standard claim made exactly for this problem. Without it, signing
    // is deterministic — the same payload + the same `iat` (issued-at,
    // which only has 1-SECOND resolution) produces a byte-identical
    // token. Two refreshes within the same second would otherwise mint
    // "different" tokens that are actually the same string, silently
    // defeating rotation (a token we thought we'd invalidated would
    // still be the current valid one).
    const payload = { sub: user.id, jti: crypto.randomUUID() };
    const rawToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpirySeconds,
    });

    // Hashing the refresh token before storing it — SAME principle as
    // password_hash, but a DIFFERENT algorithm on purpose. bcrypt is slow
    // BY DESIGN to resist brute-forcing a low-entropy, human-chosen
    // password. A refresh token is a 256-bit-random, machine-generated
    // JWT — nobody is going to brute-force-guess it, so we don't need
    // bcrypt's deliberate slowness (which would also make every single
    // /auth/refresh request unnecessarily slow). A fast cryptographic
    // hash (SHA-256) is the correct tool here: we're only defending
    // against "this hash leaked, is it directly reusable" (no), not
    // "can someone guess the input" (already infeasible for random data).
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + refreshExpirySeconds * 1000);

    const record = this.refreshTokenRepo.create({
      tokenHash,
      userId: user.id,
      expiresAt,
    });
    await this.refreshTokenRepo.save(record);

    return rawToken;
  }

  private parseExpiryToSeconds(expiry: string): number {
    // Minimal parser for our own config format ("15m", "7d", "3600s") —
    // not meant to handle every unit ms/jsonwebtoken support; we control
    // the actual values ourselves in .env, so this only needs to cover
    // what we actually write there.
    const match = /^(\d+)(s|m|h|d)$/.exec(expiry);
    if (!match) return 900; // fallback: 15 minutes, in seconds
    const value = parseInt(match[1], 10);
    const unitToSeconds = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * unitToSeconds[match[2] as 's' | 'm' | 'h' | 'd'];
  }
}
