import { randomBytes } from 'node:crypto';
import { Env, loadEnv } from '../src/config/env.schema';

export const TEST_ENC_KEY = randomBytes(32).toString('base64');

export function testEnv(overrides: Record<string, string | undefined> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'j'.repeat(40),
    CONTACT_HASH_SECRET: 'h'.repeat(40),
    CONTACT_ENC_KEY: TEST_ENC_KEY,
    SUPER_ADMIN_EMAIL: 'super@example.org',
    SMS_PROVIDER: 'fake',
    ...overrides,
  } as NodeJS.ProcessEnv);
}
