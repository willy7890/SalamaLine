import { loadEnv } from '../../src/config/env.schema';
import { testEnv } from '../helpers';

const prod = {
  NODE_ENV: 'production',
  REDIS_URL: 'redis://localhost:6379',
  SMS_PROVIDER: 'africastalking',
  AT_USERNAME: 'u',
  AT_API_KEY: 'k',
  WEBHOOK_SHARED_SECRET: 'w'.repeat(30),
  HELPLINE_NUMBER: '116',
};

describe('environment validation', () => {
  it('accepts a valid development config', () => expect(testEnv().SMS_PROVIDER).toBe('fake'));

  it('rejects a wrong-size encryption key', () => {
    expect(() => testEnv({ CONTACT_ENC_KEY: Buffer.from('short').toString('base64') })).toThrow(/CONTACT_ENC_KEY/);
  });
  it('requires the hash pepper to differ from the JWT secret', () => {
    expect(() => testEnv({ CONTACT_HASH_SECRET: 'j'.repeat(40) })).toThrow(/CONTACT_HASH_SECRET/);
  });
  it('accepts a complete production config', () => expect(testEnv(prod).NODE_ENV).toBe('production'));
  it.each([
    ['fake SMS provider', { SMS_PROVIDER: 'fake' }, /SMS_PROVIDER/],
    ['no redis', { REDIS_URL: undefined }, /REDIS_URL/],
    ['no webhook secret', { WEBHOOK_SHARED_SECRET: undefined }, /WEBHOOK_SHARED_SECRET/],
    ['no helpline', { HELPLINE_NUMBER: undefined }, /HELPLINE_NUMBER/],
  ])('refuses production with %s', (_n, change, re) => {
    expect(() => testEnv({ ...prod, ...change })).toThrow(re);
  });
  it('never prints secret values in the error message', () => {
    try {
      loadEnv({ DATABASE_URL: 'x', JWT_ACCESS_SECRET: 'tooshort', CONTACT_HASH_SECRET: 'tooshort', CONTACT_ENC_KEY: 'bm9wZQ==', SUPER_ADMIN_EMAIL: 'a@b.co' } as NodeJS.ProcessEnv);
      throw new Error('should not pass');
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('tooshort');
    }
  });
});
