import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Why this table exists at all: a bare JWT refresh token can't be revoked
// early (Step 7) — anyone holding it stays valid until it expires, even
// after logout. Storing a record per issued token here is what makes
// "log out" and "log out of all devices" actually possible: we delete
// the row, and the token becomes unusable even though it would otherwise
// still pass signature verification.
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // We store a HASH of the token, never the raw token itself — same
  // reasoning as password_hash. If this table ever leaked, raw tokens
  // would let an attacker impersonate every user with a valid session;
  // a hash is useless to them without the original value.
  @Column({ name: 'token_hash', unique: true })
  tokenHash: string;

  // @ManyToOne: many refresh tokens can belong to one user (e.g. one per
  // device/browser they're logged in on).
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
