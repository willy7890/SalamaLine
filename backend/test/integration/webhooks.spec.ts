import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { SmsController } from '../../src/channels/sms/sms.controller';
import { UssdController } from '../../src/channels/ussd/ussd.controller';
import { UssdService } from '../../src/channels/ussd/ussd.service';
import { WhatsAppController } from '../../src/channels/whatsapp/whatsapp.controller';
import { ConversationService } from '../../src/channels/conversation.service';
import { ReplyService } from '../../src/channels/reply.service';
import { WebhookSecretGuard } from '../../src/common/guards/webhook-secret.guard';
import { WhatsAppSignatureGuard } from '../../src/common/guards/whatsapp-signature.guard';
import { IdempotencyService } from '../../src/common/idempotency/idempotency.service';
import { ENV } from '../../src/config/config.module';
import { testEnv } from '../helpers';

const SECRET = 'w'.repeat(30);
const WA_SECRET = 'app-secret';

async function boot(envOver: Record<string, string> = {}) {
  const env = testEnv({ WEBHOOK_SHARED_SECRET: SECRET, WHATSAPP_APP_SECRET: WA_SECRET, WHATSAPP_VERIFY_TOKEN: 'verify-me', ...envOver });
  const seen = new Set<string>();
  const mocks = {
    ussd: { handle: jest.fn(async () => 'CON hello') },
    conversation: { handle: jest.fn(async () => ['reply']) },
    replies: { reply: jest.fn(async () => undefined) },
    idempotency: { once: jest.fn(async (p: string, id: string) => !seen.has(`${p}:${id}`) && !!seen.add(`${p}:${id}`)), forget: jest.fn(async () => undefined) },
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [UssdController, SmsController, WhatsAppController],
    providers: [
      { provide: ENV, useValue: env },
      { provide: UssdService, useValue: mocks.ussd },
      { provide: ConversationService, useValue: mocks.conversation },
      { provide: ReplyService, useValue: mocks.replies },
      { provide: IdempotencyService, useValue: mocks.idempotency },
      WebhookSecretGuard,
      WhatsAppSignatureGuard,
    ],
  }).compile();
  const app: INestApplication = moduleRef.createNestApplication({ rawBody: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return { app, mocks };
}

describe('USSD webhook', () => {
  let ctx: Awaited<ReturnType<typeof boot>>;
  beforeAll(async () => (ctx = await boot()));
  afterAll(() => ctx.app.close());
  const form = { sessionId: 's1', serviceCode: '*123#', phoneNumber: '+255712345678', networkCode: '99', text: '1*2' };

  it('rejects calls without the shared secret', async () => {
    await request(ctx.app.getHttpServer()).post('/webhooks/ussd').type('form').send(form).expect(401);
    await request(ctx.app.getHttpServer()).post('/webhooks/ussd').set('x-webhook-secret', 'wrong').type('form').send(form).expect(401);
    expect(ctx.mocks.ussd.handle).not.toHaveBeenCalled();
  });

  it('accepts form-encoded callbacks (header or ?token=) and answers as plain text', async () => {
    const res = await request(ctx.app.getHttpServer()).post('/webhooks/ussd').set('x-webhook-secret', SECRET).type('form').send(form).expect(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toBe('CON hello');
    expect(ctx.mocks.ussd.handle).toHaveBeenCalledWith({ sessionId: 's1', phone: '+255712345678', text: '1*2' });
    await request(ctx.app.getHttpServer()).post(`/webhooks/ussd?token=${SECRET}`).type('form').send(form).expect(200);
  });

  it('rejects malformed callbacks', async () => {
    await request(ctx.app.getHttpServer()).post('/webhooks/ussd').set('x-webhook-secret', SECRET).type('form').send({ sessionId: 's1', phoneNumber: 'junk' }).expect(400);
  });
});

describe('SMS webhook', () => {
  let ctx: Awaited<ReturnType<typeof boot>>;
  beforeAll(async () => (ctx = await boot()));
  afterAll(() => ctx.app.close());
  const post = (body: object) => request(ctx.app.getHttpServer()).post('/webhooks/sms').set('x-webhook-secret', SECRET).type('form').send(body);

  it('handles a message once; a gateway retry of the same id is ignored', async () => {
    await post({ from: '+255712345678', text: 'SALAMA', id: 'm1' }).expect(200, { status: 'ok' });
    await post({ from: '+255712345678', text: 'SALAMA', id: 'm1' }).expect(200, { status: 'duplicate' });
    expect(ctx.mocks.conversation.handle).toHaveBeenCalledTimes(1);
    expect(ctx.mocks.replies.reply).toHaveBeenCalledWith('SMS', '+255712345678', ['reply']);
  });

  it('on failure it un-marks the id and returns 5xx so the gateway retries instead of losing the message', async () => {
    ctx.mocks.conversation.handle.mockRejectedValueOnce(new Error('db down'));
    await post({ from: '+255712345678', text: 'MSAADA kyela', id: 'm2' }).expect(500);
    expect(ctx.mocks.idempotency.forget).toHaveBeenCalledWith('sms', 'm2');
  });

  it('requires the secret and a valid sender', async () => {
    await request(ctx.app.getHttpServer()).post('/webhooks/sms').type('form').send({ from: '+255712345678', text: 'x', id: 'm3' }).expect(401);
    await post({ from: 'junk', text: 'x', id: 'm4' }).expect(400);
  });
});

describe('WhatsApp webhook', () => {
  let ctx: Awaited<ReturnType<typeof boot>>;
  beforeAll(async () => (ctx = await boot()));
  afterAll(() => ctx.app.close());
  const payload = { entry: [{ changes: [{ value: { messages: [{ id: 'wamid.1', from: '255712345678', type: 'text', text: { body: 'KLINIKI Kyela' } }] } }] }] };
  const sign = (raw: string) => `sha256=${createHmac('sha256', WA_SECRET).update(raw).digest('hex')}`;

  it('completes Meta\'s verification handshake only with the right token', async () => {
    await request(ctx.app.getHttpServer()).get('/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '1234' }).expect(200, '1234');
    await request(ctx.app.getHttpServer()).get('/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '1234' }).expect(403);
  });

  it('rejects unsigned or wrongly signed deliveries', async () => {
    await request(ctx.app.getHttpServer()).post('/webhooks/whatsapp').send(payload).expect(401);
    await request(ctx.app.getHttpServer()).post('/webhooks/whatsapp').set('x-hub-signature-256', 'sha256=deadbeef').send(payload).expect(401);
    expect(ctx.mocks.conversation.handle).not.toHaveBeenCalled();
  });

  it('accepts a correctly signed delivery, de-duplicates, and replies on WhatsApp', async () => {
    const raw = JSON.stringify(payload);
    const send = () => request(ctx.app.getHttpServer()).post('/webhooks/whatsapp').set('Content-Type', 'application/json').set('x-hub-signature-256', sign(raw)).send(raw);
    await send().expect(200);
    await send().expect(200);
    expect(ctx.mocks.conversation.handle).toHaveBeenCalledTimes(1);
    expect(ctx.mocks.conversation.handle).toHaveBeenCalledWith('WHATSAPP', '+255712345678', 'KLINIKI Kyela');
    expect(ctx.mocks.replies.reply).toHaveBeenCalledWith('WHATSAPP', '+255712345678', ['reply']);
  });
});

describe('webhooks in production without secrets', () => {
  it('fail closed', async () => {
    const guard = new WebhookSecretGuard(testEnv({ NODE_ENV: 'production', REDIS_URL: 'redis://x', SMS_PROVIDER: 'africastalking', AT_USERNAME: 'u', AT_API_KEY: 'k', WEBHOOK_SHARED_SECRET: 'w'.repeat(30), HELPLINE_NUMBER: '116' }));
    const ctxFor = (headers: Record<string, string>) => ({ switchToHttp: () => ({ getRequest: () => ({ headers, query: {}, ip: '1.2.3.4' }) }) }) as never;
    expect(() => guard.canActivate(ctxFor({}))).toThrow();
    expect(guard.canActivate(ctxFor({ 'x-webhook-secret': 'w'.repeat(30) }))).toBe(true);
  });

  it('enforces the optional IP allowlist', () => {
    const guard = new WebhookSecretGuard(testEnv({ WEBHOOK_SHARED_SECRET: SECRET, WEBHOOK_IP_ALLOWLIST: '10.0.0.1, 10.0.0.2' }));
    const ctxFor = (ip: string) => ({ switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-webhook-secret': SECRET }, query: {}, ip }) }) }) as never;
    expect(guard.canActivate(ctxFor('::ffff:10.0.0.2'))).toBe(true);
    expect(() => guard.canActivate(ctxFor('9.9.9.9'))).toThrow();
  });
});
