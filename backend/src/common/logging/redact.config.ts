import type { LoggerOptions } from 'pino';

/** Field names that must never reach a log line. */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-webhook-secret"]',
  'req.headers["x-hub-signature-256"]',
  'req.body',
  'req.query',
  'res.headers["set-cookie"]',
  'phone',
  'phoneNumber',
  'sender',
  'recipient',
  'contact',
  'from',
  'to',
  'text',
  'message',
  'body',
  'password',
  'token',
  '*.phone',
  '*.phoneNumber',
  '*.sender',
  '*.recipient',
  '*.contact',
  '*.from',
  '*.to',
  '*.text',
  '*.message',
  '*.body',
  '*.password',
  '*.token',
  '*.accessToken',
  '*.contactEnc',
  '*.recipientEnc',
];

const PHONE_LIKE = /\+?\d[\d\s\-()]{7,}\d/g;

/** Scrubs phone-number-looking sequences from free-text log messages. */
export const scrubHook: NonNullable<LoggerOptions['hooks']>['logMethod'] = function (args, method) {
  const scrubbed = args.map((a) => (typeof a === 'string' ? a.replace(PHONE_LIKE, '[number]') : a));
  return method.apply(this, scrubbed as unknown as Parameters<typeof method>);
};

export function buildPinoOptions(isProd: boolean): LoggerOptions {
  return {
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
    hooks: { logMethod: scrubHook },
  };
}
