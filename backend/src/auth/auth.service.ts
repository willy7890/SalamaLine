import { BadRequestException, ConflictException, HttpException, HttpStatus, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PhoneHashService } from '../common/crypto/phone-hash.service';
import { TotpService } from '../common/crypto/totp.service';
import { ENV, Env } from '../config/config.module';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { KV_STORE, KvStore } from '../infrastructure/redis/kv-store';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export const JWT_ISSUER = 'salamaline';
export const JWT_AUDIENCE = 'salamaline-staff';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;
const TOTP_REPLAY_SECONDS = 120;

@Injectable()
export class AuthService {
  /** Compared against when the account does not exist, so response time does not reveal valid emails. */
  private readonly dummyHash: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly hashes: PhoneHashService,
    private readonly crypto: FieldEncryptionService,
    private readonly totp: TotpService,
    @Inject(KV_STORE) private readonly kv: KvStore,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.dummyHash = bcrypt.hashSync('not-a-real-password', env.BCRYPT_ROUNDS);
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Unable to create account with these details');
    const passwordHash = await bcrypt.hash(dto.password, this.env.BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, displayName: dto.displayName.trim(), isActive: false },
      select: { id: true, email: true, displayName: true, role: true, isActive: true, createdAt: true },
    });
    await this.audit.record({ actorUserId: user.id, action: 'AUTH_REGISTER', resourceType: 'User', resourceId: user.id, outcome: 'SUCCESS' });
    return { message: 'Account created. An administrator must activate staff access.', user };
  }

  private failKey(scope: string, id: string) {
    return `fail:${this.hashes.hashScoped(scope, id)}`;
  }

  private async assertNotLocked(key: string) {
    if (Number((await this.kv.get(key)) ?? 0) >= MAX_FAILED_ATTEMPTS) {
      throw new HttpException('Too many failed attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private signToken(user: { id: string; role: string }, mfa: boolean) {
    return this.jwt.signAsync({ sub: user.id, role: user.role, mfa });
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const lockKey = this.failKey('login', email);
    await this.assertNotLocked(lockKey);

    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? this.dummyHash);
    if (!user || !valid || !user.isActive) {
      await this.kv.incr(lockKey, LOCKOUT_SECONDS);
      await this.audit.record({ actorUserId: user?.id, action: 'AUTH_LOGIN', resourceType: 'User', resourceId: user?.id, outcome: 'DENIED' });
      throw new UnauthorizedException('Invalid credentials or account not activated');
    }

    let mfa = false;
    if (user.totpEnabledAt && user.totpSecretEnc) {
      // Only revealed after the password was right, so it does not leak which accounts have 2FA.
      if (!dto.totpCode) throw new UnauthorizedException({ statusCode: 401, message: 'Authentication code required', code: 'MFA_REQUIRED' });
      const secret = this.crypto.decrypt(user.totpSecretEnc, `user-totp:${user.id}`);
      const step = this.totp.verify(secret, dto.totpCode);
      const replayKey = step === null ? null : `totp-used:${user.id}:${step}`;
      if (step === null || (replayKey && (await this.kv.get(replayKey)))) {
        await this.kv.incr(lockKey, LOCKOUT_SECONDS);
        await this.audit.record({ actorUserId: user.id, action: 'AUTH_MFA', resourceType: 'User', resourceId: user.id, outcome: 'DENIED' });
        throw new UnauthorizedException('Invalid authentication code');
      }
      await this.kv.set(replayKey!, '1', TOTP_REPLAY_SECONDS); // a code works once
      mfa = true;
    }

    await this.kv.del(lockKey);
    await this.audit.record({ actorUserId: user.id, action: 'AUTH_LOGIN', resourceType: 'User', resourceId: user.id, outcome: 'SUCCESS' });
    return {
      accessToken: await this.signToken(user, mfa),
      tokenType: 'Bearer',
      expiresIn: this.env.JWT_ACCESS_TTL,
      mfa,
      mfaSetupRequired: this.env.REQUIRE_MFA_STAFF && !user.totpEnabledAt,
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, districtCode: user.districtCode },
    };
  }

  /** Step 1 of 2FA setup: returns the secret (shown once) and an otpauth:// URL for a QR code. Not active until confirmed. */
  async enrollMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    if (user.totpEnabledAt) throw new ConflictException('2FA is already enabled. Ask an administrator to reset it first.');
    const secret = this.totp.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecretEnc: this.crypto.encrypt(secret, `user-totp:${userId}`) } });
    await this.audit.record({ actorUserId: userId, action: 'MFA_ENROLL_STARTED', resourceType: 'User', resourceId: userId, outcome: 'SUCCESS' });
    return { secret, otpauthUrl: this.totp.otpauthUrl(user.email, secret, this.env.MFA_ISSUER) };
  }

  /** Step 2: proves the authenticator works. Returns a fresh token that carries the 2FA claim. */
  async confirmMfa(userId: string, code: string) {
    const lockKey = this.failKey('mfa-confirm', userId);
    await this.assertNotLocked(lockKey);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecretEnc) throw new BadRequestException('Start 2FA setup first');
    if (user.totpEnabledAt) throw new ConflictException('2FA is already enabled');
    const step = this.totp.verify(this.crypto.decrypt(user.totpSecretEnc, `user-totp:${userId}`), code);
    if (step === null) {
      await this.kv.incr(lockKey, LOCKOUT_SECONDS);
      throw new BadRequestException('Invalid authentication code');
    }
    await this.kv.set(`totp-used:${userId}:${step}`, '1', TOTP_REPLAY_SECONDS);
    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabledAt: new Date() } });
    await this.kv.del(lockKey);
    await this.audit.record({ actorUserId: userId, action: 'MFA_ENABLED', resourceType: 'User', resourceId: userId, outcome: 'SUCCESS' });
    return { mfa: true, accessToken: await this.signToken(user, true), tokenType: 'Bearer', expiresIn: this.env.JWT_ACCESS_TTL };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const lockKey = this.failKey('pwchange', userId);
    await this.assertNotLocked(lockKey);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      await this.kv.incr(lockKey, LOCKOUT_SECONDS);
      await this.audit.record({ actorUserId: userId, action: 'PASSWORD_CHANGE', resourceType: 'User', resourceId: userId, outcome: 'DENIED' });
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (currentPassword === newPassword) throw new BadRequestException('New password must be different');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, this.env.BCRYPT_ROUNDS) } });
    await this.kv.del(lockKey);
    await this.audit.record({ actorUserId: userId, action: 'PASSWORD_CHANGE', resourceType: 'User', resourceId: userId, outcome: 'SUCCESS' });
    return { message: 'Password changed. Existing sessions stay valid until their access token expires.' };
  }
}
