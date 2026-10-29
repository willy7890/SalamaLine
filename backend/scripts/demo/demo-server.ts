/**
 * `npm run demo`: runs the REAL SalamaLine API (same modules, controllers, guards, USSD engine) with an in-memory
 * database and a fake SMS gateway, so you can try it with curl/Postman without PostgreSQL, Redis or Africa's Talking.
 * Extra demo-only routes: GET /demo/outbox (SMS that "would have been sent"), POST /demo/tick (run escalation +
 * delivery as if 11 minutes passed), GET /demo/db (what is stored: shows no names/message text and no clear numbers).
 */
import 'reflect-metadata';
import { randomBytes } from 'node:crypto';

const demoEnv: Record<string, string> = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://demo:demo@localhost:5432/demo',
  JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
  CONTACT_HASH_SECRET: randomBytes(32).toString('hex'),
  CONTACT_ENC_KEY: randomBytes(32).toString('base64'),
  SUPER_ADMIN_EMAIL: 'admin@demo.local',
  SMS_PROVIDER: 'fake',
  WHATSAPP_PROVIDER: 'fake',
  WEBHOOK_SHARED_SECRET: 'demo-webhook-secret-demo-webhook',
  HELPLINE_NUMBER: '116',
  REQUIRE_MFA_STAFF: 'false',
  PORT: process.env.PORT ?? '3000',
};
for (const [k, v] of Object.entries(demoEnv)) process.env[k] ??= v;

async function main() {
  // Imported after env is set (the config module reads it at load time).
  const { NestFactory } = await import('@nestjs/core');
  const { ValidationPipe } = await import('@nestjs/common');
  const { Test } = await import('@nestjs/testing');
  const { AppModule } = await import('../../src/app.module');
  const { PrismaService } = await import('../../src/infrastructure/prisma/prisma.service');
  const { AllExceptionsFilter } = await import('../../src/common/filters/all-exceptions.filter');
  const { FieldEncryptionService } = await import('../../src/common/crypto/field-encryption.service');
  const { PhoneHashService } = await import('../../src/common/crypto/phone-hash.service');
  const { MESSAGE_GATEWAYS } = await import('../../src/gateways/message-gateway');
  const { EscalationService } = await import('../../src/modules/help-requests/escalation.service');
  const { NotificationsService } = await import('../../src/modules/notifications/notifications.service');
  const { InMemoryPrisma } = await import('./in-memory-prisma');
  void NestFactory;

  const db = new InMemoryPrisma();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(db).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── demo data ──
  const crypto = app.get(FieldEncryptionService);
  const hashes = app.get(PhoneHashService);
  await db.district.create({ data: { code: 'KYELA', nameSw: 'Kyela', nameEn: 'Kyela', region: 'Mbeya', isActive: true } });
  await db.district.create({ data: { code: 'MBEYA_CITY', nameSw: 'Jiji la Mbeya', nameEn: 'Mbeya City', region: 'Mbeya', isActive: true } });
  const responder = await db.user.create({ data: { email: 'responder@demo.local', passwordHash: 'x', displayName: 'Demo Responder', role: 'RESPONDER', districtCode: 'KYELA', isActive: true } });
  await db.user.update({ where: { id: responder.id }, data: { phoneEnc: crypto.encrypt('+255700000001', `user-phone:${responder.id}`), phoneHash: hashes.hash('+255700000001') } });
  const focal = await db.user.create({ data: { email: 'focal@demo.local', passwordHash: 'x', displayName: 'Demo Focal Person', role: 'DISTRICT_FOCAL', districtCode: 'KYELA', isActive: true } });
  await db.user.update({ where: { id: focal.id }, data: { phoneEnc: crypto.encrypt('+255700000002', `user-phone:${focal.id}`), phoneHash: hashes.hash('+255700000002') } });
  const reviewer = await db.user.create({ data: { email: 'reviewer@demo.local', passwordHash: 'x', displayName: 'Demo Reviewer', role: 'CONTENT_REVIEWER', isActive: true } });
  await db.content.create({ data: { slug: 'ndoa-demo', title: 'Ndoa za utotoni (DEMO)', language: 'sw', topic: 'CHILD_MARRIAGE', shortText: 'DEMO: Ndoa kabla ya miaka 18 ni hatari kwa afya na elimu.', fullText: 'DEMO TEXT, not real approved content. Replace with professionally approved material.', sourceName: 'DEMO', status: 'APPROVED', reviewerId: reviewer.id, publishedAt: new Date() } });
  await db.serviceDirectoryEntry.create({ data: { name: 'DEMO Kituo cha Afya Kyela', type: 'CLINIC', districtCode: 'KYELA', phonePublic: '+255700999000', openingHours: '8-17', verificationOrg: 'DEMO', verifiedBy: 'DEMO', verifiedAt: new Date(Date.now() - 86_400_000), expiresAt: new Date(Date.now() + 365 * 86_400_000), isActive: true } });

  // ── demo-only routes ──
  const http = app.getHttpAdapter().getInstance();
  const gateways = app.get<Array<{ channel: string; outbox?: Array<{ to: string; text: string }> }>>(MESSAGE_GATEWAYS);
  http.get('/demo/outbox', (_req: unknown, res: { json: (b: unknown) => void }) => res.json(gateways.flatMap((g) => (g.outbox ?? []).map((m) => ({ channel: g.channel, ...m })))));
  let clockOffsetMs = 0; // each tick moves the demo clock forward 11 minutes
  http.post('/demo/tick', async (_req: unknown, res: { json: (b: unknown) => void }) => {
    clockOffsetMs += 11 * 60_000;
    const later = new Date(Date.now() + clockOffsetMs);
    const escalation = await app.get(EscalationService).runOnce(later);
    const sent = await app.get(NotificationsService).processDue(50, later);
    res.json({ escalation, notificationsSent: sent });
  });
  http.get('/demo/db', (_req: unknown, res: { json: (b: unknown) => void }) =>
    res.json({ helpRequests: db.helpRequest.rows, notifications: db.notification.rows.map((n) => ({ ...n, body: n.body })), metrics: db.anonymousMetric.rows }));

  await app.listen(Number(process.env.PORT));
  const base = `http://localhost:${process.env.PORT}`;
  console.info(`\nSalamaLine DEMO running (in-memory data, fake SMS): ${base}/api/v1/health\n`);
  console.info(`Try:\n  curl -s -X POST ${base}/api/v1/webhooks/ussd -H 'x-webhook-secret: ${demoEnv.WEBHOOK_SHARED_SECRET}' -d 'sessionId=s1' -d 'phoneNumber=+255712345678' -d 'text='\n  curl -s ${base}/demo/outbox\n`);
}
void main();
