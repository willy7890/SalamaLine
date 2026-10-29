import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', 'on', 'off'])
  .transform((v) => ['true', '1', 'on'].includes(v));

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const secret = (min: number) => z.string().min(min, `must be at least ${min} characters`);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(0).max(65535).default(3000),
    HOST: optionalString,
    API_PREFIX: z.string().default('api/v1'),
    FRONTEND_ORIGINS: z.string().default('http://localhost:5173'),
    TRUST_PROXY: bool.default('false'),
    SWAGGER_ENABLED: optionalString.transform((v) => (v === undefined ? undefined : ['true', '1', 'on'].includes(v))),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: optionalString,

    JWT_ACCESS_SECRET: secret(32),
    JWT_ACCESS_TTL: z.string().default('15m'),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    CONTACT_HASH_SECRET: secret(32),
    CONTACT_ENC_KEY: z.string().min(1, 'required (base64 of 32 random bytes)'),
    CONTACT_ENC_KEY_VERSION: z.coerce.number().int().min(1).max(99).default(1),
    CONTACT_ENC_KEY_PREVIOUS: optionalString,
    CONTACT_ENC_KEY_PREVIOUS_VERSION: z.coerce.number().int().min(1).max(99).optional(),

    SUPER_ADMIN_EMAIL: z.string().email().transform((v) => v.trim().toLowerCase()),

    SMS_PROVIDER: z.enum(['disabled', 'fake', 'africastalking']).default('disabled'),
    AT_USERNAME: optionalString,
    AT_API_KEY: optionalString,
    AT_SENDER_ID: optionalString,
    AT_BASE_URL: z.string().url().default('https://api.africastalking.com'),
    WHATSAPP_PROVIDER: z.enum(['disabled', 'fake', 'cloud']).default('disabled'),
    WHATSAPP_PHONE_NUMBER_ID: optionalString,
    WHATSAPP_ACCESS_TOKEN: optionalString,
    WHATSAPP_APP_SECRET: optionalString,
    WHATSAPP_VERIFY_TOKEN: optionalString,
    WEBHOOK_SHARED_SECRET: optionalString,
    WEBHOOK_IP_ALLOWLIST: optionalString.transform((v) =>
      v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [],
    ),

    HELPLINE_NUMBER: optionalString,
    ESCALATION_REMINDER_MINUTES: z.coerce.number().int().min(1).max(240).default(10),
    ESCALATION_REMINDERS_BEFORE_FOCAL: z.coerce.number().int().min(0).max(10).default(2),
    CONTACT_MAX_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    SMALL_COUNT_THRESHOLD: z.coerce.number().int().min(2).max(100).default(5),
    AUDIT_RETENTION_DAYS: z.coerce.number().int().min(90).max(3650).default(730),
    MFA_ISSUER: z.string().min(1).max(40).default('SalamaLine'),
    // Staff 2FA. Unset = ON in production, OFF elsewhere.
    REQUIRE_MFA_STAFF: optionalString.transform((v) => (v === undefined ? undefined : ['true', '1', 'on'].includes(v))),
  })
  .superRefine((env, ctx) => {
    const add = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });

    const key = Buffer.from(env.CONTACT_ENC_KEY, 'base64');
    if (key.length !== 32) add('CONTACT_ENC_KEY', 'must be base64 of exactly 32 bytes (run: npm run gen:keys)');
    if (env.CONTACT_ENC_KEY_PREVIOUS) {
      if (Buffer.from(env.CONTACT_ENC_KEY_PREVIOUS, 'base64').length !== 32)
        add('CONTACT_ENC_KEY_PREVIOUS', 'must be base64 of exactly 32 bytes');
      if (!env.CONTACT_ENC_KEY_PREVIOUS_VERSION)
        add('CONTACT_ENC_KEY_PREVIOUS_VERSION', 'required when CONTACT_ENC_KEY_PREVIOUS is set');
      if (env.CONTACT_ENC_KEY_PREVIOUS_VERSION === env.CONTACT_ENC_KEY_VERSION)
        add('CONTACT_ENC_KEY_PREVIOUS_VERSION', 'must differ from CONTACT_ENC_KEY_VERSION');
    }
    if (env.CONTACT_HASH_SECRET === env.JWT_ACCESS_SECRET)
      add('CONTACT_HASH_SECRET', 'must differ from JWT_ACCESS_SECRET');

    if (env.SMS_PROVIDER === 'africastalking') {
      if (!env.AT_USERNAME) add('AT_USERNAME', 'required for SMS_PROVIDER=africastalking');
      if (!env.AT_API_KEY) add('AT_API_KEY', 'required for SMS_PROVIDER=africastalking');
    }
    if (env.WHATSAPP_PROVIDER === 'cloud') {
      for (const k of ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN'] as const) {
        if (!env[k]) add(k, 'required for WHATSAPP_PROVIDER=cloud');
      }
    }

    if (env.NODE_ENV === 'production') {
      if (env.SMS_PROVIDER === 'fake') add('SMS_PROVIDER', 'fake is not allowed in production');
      if (env.WHATSAPP_PROVIDER === 'fake') add('WHATSAPP_PROVIDER', 'fake is not allowed in production');
      if (!env.REDIS_URL) add('REDIS_URL', 'required in production (rate limits and lockouts must be shared)');
      if (env.SMS_PROVIDER === 'disabled')
        add('SMS_PROVIDER', 'disabled in production means responders can never be alerted');
      if (env.SMS_PROVIDER !== 'disabled' && (!env.WEBHOOK_SHARED_SECRET || env.WEBHOOK_SHARED_SECRET.length < 24))
        add('WEBHOOK_SHARED_SECRET', 'required (>= 24 chars) in production when SMS is enabled');
      if (!env.HELPLINE_NUMBER) add('HELPLINE_NUMBER', 'required in production (shown on low wellbeing check-ins)');
      if (/replace-me|changeme|development-only/i.test(env.JWT_ACCESS_SECRET + env.CONTACT_HASH_SECRET))
        add('JWT_ACCESS_SECRET', 'looks like a placeholder; generate real secrets');
      if (env.REQUIRE_MFA_STAFF === false) add('REQUIRE_MFA_STAFF', 'staff 2FA cannot be disabled in production');
    }
  })
  .transform((env) => ({ ...env, REQUIRE_MFA_STAFF: env.REQUIRE_MFA_STAFF ?? env.NODE_ENV === 'production' }));

export type Env = z.output<typeof envSchema>;

/** Parses and validates environment variables. Error output lists key names and reasons only, never values. */
export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => ` - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
