import { HttpException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../src/auth/auth.service';
import { FieldEncryptionService } from '../../src/common/crypto/field-encryption.service';
import { PhoneHashService } from '../../src/common/crypto/phone-hash.service';
import { TotpService } from '../../src/common/crypto/totp.service';
import { MemoryKvStore } from '../../src/infrastructure/redis/memory-kv.store';
import { testEnv } from '../helpers';

describe('AuthService', () => {
  const env = testEnv({ BCRYPT_ROUNDS: '10' });
  const crypto = new FieldEncryptionService(env);
  const totp = new TotpService();
  let users: Map<string, Record<string, unknown>>;
  let auth: AuthService;
  const audit = { record: jest.fn() };
  const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };

  beforeEach(() => {
    users = new Map();
    audit.record.mockClear();
    jwt.signAsync.mockClear();
    const prisma = {
      user: {
        findUnique: jest.fn(async ({ where }: { where: { email?: string; id?: string } }) =>
          where.email ? (users.get(where.email) ?? null) : ([...users.values()].find((u) => u.id === where.id) ?? null),
        ),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const u = [...users.values()].find((x) => x.id === where.id)!;
          Object.assign(u, data);
          return u;
        }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const u = { id: 'user-1', role: UserRole.RESPONDER, districtCode: null, createdAt: new Date(), ...data };
          users.set(String(data.email), u);
          return u;
        }),
      },
    };
    auth = new AuthService(prisma as never, jwt as unknown as JwtService, audit as never, new PhoneHashService(env), crypto, totp, new MemoryKvStore(), env);
  });

  const creds = { email: 'responder@example.org', password: 'A-long-password-123!' };

  it('registers new staff as inactive RESPONDERs and never stores the plain password', async () => {
    const res = await auth.register({ ...creds, email: 'Responder@Example.org', displayName: '  Amani Juma  ' });
    expect(res.user).toMatchObject({ email: 'responder@example.org', displayName: 'Amani Juma', role: UserRole.RESPONDER, isActive: false });
    const stored = users.get('responder@example.org')!;
    expect(String(stored.passwordHash)).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare(creds.password, String(stored.passwordHash))).toBe(true);
  });

  it('rejects login until an administrator activates the account', async () => {
    await auth.register({ ...creds, displayName: 'Amani' });
    await expect(auth.login(creds)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
    users.get('responder@example.org')!.isActive = true;
    await expect(auth.login(creds)).resolves.toMatchObject({ accessToken: 'access-token', user: { role: UserRole.RESPONDER } });
  });

  it('gives the same error for unknown email and wrong password', async () => {
    await auth.register({ ...creds, displayName: 'Amani' });
    users.get('responder@example.org')!.isActive = true;
    const unknown = await auth.login({ email: 'nobody@example.org', password: 'x' }).catch((e) => e);
    const wrong = await auth.login({ ...creds, password: 'wrong-password' }).catch((e) => e);
    expect(unknown).toBeInstanceOf(UnauthorizedException);
    expect(unknown.message).toBe(wrong.message);
  });

  it('locks the account after 5 failed attempts (429), even for the right password', async () => {
    await auth.register({ ...creds, displayName: 'Amani' });
    users.get('responder@example.org')!.isActive = true;
    for (let i = 0; i < 5; i++) await auth.login({ ...creds, password: 'wrong' }).catch(() => undefined);
    const err = await auth.login(creds).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
  });

  it('a successful login resets the failure counter', async () => {
    await auth.register({ ...creds, displayName: 'Amani' });
    users.get('responder@example.org')!.isActive = true;
    for (let i = 0; i < 4; i++) await auth.login({ ...creds, password: 'wrong' }).catch(() => undefined);
    await auth.login(creds);
    for (let i = 0; i < 4; i++) await auth.login({ ...creds, password: 'wrong' }).catch(() => undefined);
    await expect(auth.login(creds)).resolves.toBeDefined();
  });

  describe('two-factor authentication', () => {
    const activate = async () => {
      await auth.register({ ...creds, displayName: 'Amani' });
      users.get('responder@example.org')!.isActive = true;
    };
    const enrol = async () => {
      await activate();
      const { secret } = await auth.enrollMfa('user-1');
      await auth.confirmMfa('user-1', totp.codeAt(secret, Date.now()));
      jwt.signAsync.mockClear();
      return secret;
    };

    it('enrolment stores the secret encrypted, and only confirmation switches 2FA on', async () => {
      await activate();
      const { secret, otpauthUrl } = await auth.enrollMfa('user-1');
      const stored = users.get('responder@example.org')!;
      expect(JSON.stringify(stored)).not.toContain(secret);
      expect(stored.totpEnabledAt).toBeUndefined();
      expect(otpauthUrl).toContain(`secret=${secret}`);
      await expect(auth.confirmMfa('user-1', '000000')).rejects.toThrow('Invalid authentication code');
      const res = await auth.confirmMfa('user-1', totp.codeAt(secret, Date.now()));
      expect(res.mfa).toBe(true);
      expect(jwt.signAsync).toHaveBeenLastCalledWith(expect.objectContaining({ mfa: true }));
      expect(stored.totpEnabledAt).toBeInstanceOf(Date);
      await expect(auth.enrollMfa('user-1')).rejects.toThrow('already enabled');
    });

    it('login then needs a code, but only after the password was correct', async () => {
      await enrol();
      const wrongPw = await auth.login({ ...creds, password: 'wrong-password' }).catch((e) => e);
      expect(wrongPw.message).toBe('Invalid credentials or account not activated');
      const missing = await auth.login(creds).catch((e) => e);
      expect(missing.getResponse()).toMatchObject({ code: 'MFA_REQUIRED' });
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('a valid code logs in with the 2FA claim; the same code cannot be used twice', async () => {
      const secret = await enrol();
      // wait for a different step than the one consumed during enrolment
      const next = totp.codeAt(secret, Date.now() + 30_000);
      const res = await auth.login({ ...creds, totpCode: next }).catch(() => null);
      // The +30s code is valid within the +/-1 window and was not used during enrolment.
      expect(res?.mfa).toBe(true);
      expect(jwt.signAsync).toHaveBeenLastCalledWith(expect.objectContaining({ mfa: true }));
      await expect(auth.login({ ...creds, totpCode: next })).rejects.toThrow('Invalid authentication code');
    });

    it('a wrong code is refused and counts toward the lockout', async () => {
      await enrol();
      for (let i = 0; i < 5; i++) await auth.login({ ...creds, totpCode: '000000' }).catch(() => undefined);
      const err = await auth.login(creds).catch((e) => e);
      expect(err.getStatus()).toBe(429);
    });

    it('without 2FA enabled the session is flagged mfa=false', async () => {
      await activate();
      const res = await auth.login(creds);
      expect(res.mfa).toBe(false);
      expect(jwt.signAsync).toHaveBeenLastCalledWith(expect.objectContaining({ mfa: false }));
    });
  });

  describe('change password', () => {
    it('needs the current password, a different new one, and then really changes the hash', async () => {
      await auth.register({ ...creds, displayName: 'Amani' });
      await expect(auth.changePassword('user-1', 'wrong', 'Another-long-password-1!')).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(auth.changePassword('user-1', creds.password, creds.password)).rejects.toThrow('different');
      await auth.changePassword('user-1', creds.password, 'Another-long-password-1!');
      const hash = String(users.get('responder@example.org')!.passwordHash);
      expect(await bcrypt.compare('Another-long-password-1!', hash)).toBe(true);
      expect(await bcrypt.compare(creds.password, hash)).toBe(false);
    });
    it('is rate limited against guessing the current password', async () => {
      await auth.register({ ...creds, displayName: 'Amani' });
      for (let i = 0; i < 5; i++) await auth.changePassword('user-1', 'wrong', 'Another-long-password-1!').catch(() => undefined);
      const err = await auth.changePassword('user-1', creds.password, 'Another-long-password-1!').catch((e) => e);
      expect(err.getStatus()).toBe(429);
    });
  });
});
