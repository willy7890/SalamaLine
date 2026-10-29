import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { WorkerModule } from '../../src/worker.module';
import { TEST_ENC_KEY } from '../helpers';

/**
 * Boots the REAL module graph (no hand-built providers) with only the database stubbed.
 * Catches missing providers/imports that unit tests with hand-made mocks cannot see.
 */
const ENV_KEYS = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'j'.repeat(40),
  CONTACT_HASH_SECRET: 'h'.repeat(40),
  CONTACT_ENC_KEY: TEST_ENC_KEY,
  SUPER_ADMIN_EMAIL: 'super@example.org',
  SMS_PROVIDER: 'fake',
  WEBHOOK_SHARED_SECRET: 'w'.repeat(30),
};

function prismaStub() {
  const model = () => ({ findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 0 }), deleteMany: jest.fn().mockResolvedValue({ count: 0 }), count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]), upsert: jest.fn() });
  return {
    onModuleInit: async () => undefined,
    onModuleDestroy: async () => undefined,
    $queryRaw: jest.fn().mockResolvedValue([1]),
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
    district: { ...model(), findMany: jest.fn().mockResolvedValue([{ code: 'KYELA', nameSw: 'Kyela', nameEn: 'Kyela', region: 'Mbeya', isActive: true }]) },
    user: model(), content: model(), serviceDirectoryEntry: model(), helpRequest: model(), notification: model(),
    processedWebhook: model(), auditEvent: model(), anonymousMetric: model(), referral: model(), consentRecord: model(),
  };
}

describe('module wiring', () => {
  const saved = { ...process.env };
  beforeAll(() => Object.assign(process.env, ENV_KEYS));
  afterAll(() => { process.env = saved; });

  it('the API module graph resolves and serves health, districts and the USSD webhook', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(prismaStub()).compile();
    const app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    const http = app.getHttpServer();

    expect((await request(http).get('/api/v1/health').expect(200)).body.status).toBe('ok');
    const ready = await request(http).get('/api/v1/health/ready').expect(200);
    expect(ready.body).toMatchObject({ status: 'ready', store: 'memory', channels: { sms: 'fake', whatsapp: 'disabled' } });
    const districts = await request(http).get('/api/v1/districts').expect(200);
    expect(districts.body[0].code).toBe('KYELA');

    // Full USSD path through the real engine + real i18n + stubbed DB: language screen, then main menu.
    const secret = { 'x-webhook-secret': ENV_KEYS.WEBHOOK_SHARED_SECRET };
    const first = await request(http).post('/api/v1/webhooks/ussd').set(secret).type('form').send({ sessionId: 's', phoneNumber: '+255712345678', text: '' }).expect(200);
    expect(first.text).toMatch(/^CON .*Kiswahili/s);
    const menu = await request(http).post('/api/v1/webhooks/ussd').set(secret).type('form').send({ sessionId: 's', phoneNumber: '+255712345678', text: '1' }).expect(200);
    expect(menu.text).toMatch(/^CON .*Naomba msaada/s);
    const districtsScreen = await request(http).post('/api/v1/webhooks/ussd').set(secret).type('form').send({ sessionId: 's', phoneNumber: '+255712345678', text: '1*3' }).expect(200);
    expect(districtsScreen.text).toContain('1 Kyela');

    // Protected routes are closed without a token; public submit validates input.
    await request(http).get('/api/v1/help-requests').expect(401);
    await request(http).get('/api/v1/admin/users').expect(401);
    await request(http).get('/api/v1/dashboard/summary').expect(401);
    await request(http).post('/api/v1/help-requests').send({ topic: 'NOPE', district: 'kyela', consentToContact: false }).expect(400);
    await request(http).post('/api/v1/webhooks/sms').type('form').send({ from: '+255712345678', text: 'x', id: '1' }).expect(401);
    await app.close();
  });

  it('the worker module graph resolves and shuts down cleanly', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).overrideProvider(PrismaService).useValue(prismaStub()).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });
});
