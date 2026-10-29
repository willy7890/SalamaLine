# SalamaLine Backend

NestJS 10 · TypeScript (strict) · PostgreSQL + Prisma · Redis · Africa's Talking (USSD/SMS) · WhatsApp Cloud API.
Mbeya University of Science and Technology (MUST) · signiAI. Read `docs/review-findings.md` first.

## Onyesho la haraka bila Postgres (`npm run demo`)
```bash
npm install && npm run demo      # http://localhost:3000 (PORT=3111 npm run demo kubadilisha port)
```
Inawasha API HALISI (code ile ile) na database ya memory + SMS bandia. Data ya mfano: wilaya Kyela na Mbeya City,
responder (+255700000001), focal person (+255700000002), maudhui ya DEMO. Njia za ziada za demo tu:
`GET /demo/outbox` (SMS zilizotumwa), `POST /demo/tick` (saa inasonga dakika 11: escalation), `GET /demo/db`.
Mfano: `curl -s -X POST localhost:3000/api/v1/webhooks/ussd -H 'x-webhook-secret: demo-webhook-secret-demo-webhook' -d sessionId=s1 -d phoneNumber=+255712345678 -d text=` (inaongeza `1*3*1*1*1` hatua kwa hatua).
Hii si mbadala wa Postgres: ni kwa kuona tabia tu.

## Kuanza (local)

```bash
cp .env.example .env
npm install
npm run gen:keys            # nakili thamani kwenye .env (JWT, HASH, ENC_KEY, WEBHOOK, WHATSAPP_VERIFY)
# weka SUPER_ADMIN_EMAIL kwenye .env (barua pepe yako); POSTGRES_PASSWORD kama unatumia docker compose

docker compose up -d db redis          # au Postgres/Redis yako mwenyewe
npx prisma migrate dev --name init     # INATENGENEZA prisma/migrations (commit folda hiyo)
SEED_ADMIN_PASSWORD='nenosiri-refu-angalau-14' npm run seed
npm run start:dev                      # API       http://localhost:3000/api/v1  (Swagger: /docs)
npm run start:worker:dev               # worker (escalation, SMS outbox, retention): ENDESHA PIA HII
npm run simulate:ussd -- +255712345678 # jaribu USSD kwenye terminal
```

> Hakuna `prisma/migrations` kwenye zip hii kwa makusudi: schema imebadilika sana, na migration lazima itengenezwe
> na Prisma kwenye mashine yako. Kwa database ya majaribio ya zamani: `npx prisma migrate reset`.
> Commit folda ya migrations; production tumia `npx prisma migrate deploy` (compose ina huduma ya `migrate`).

## Amri
`npm test` · `npm run typecheck` · `npm run lint` · `npm run build` · `npm run start:prod` · `npm run start:worker`

## Kuunganisha Africa's Talking
1. SMS_PROVIDER=africastalking, AT_USERNAME, AT_API_KEY (sandbox kwanza: `AT_BASE_URL=https://api.sandbox.africastalking.com`).
2. Callback URLs kwenye dashboard ya AT:
   - USSD: `https://<domain>/api/v1/webhooks/ussd?token=<WEBHOOK_SHARED_SECRET>`
   - SMS inbound: `https://<domain>/api/v1/webhooks/sms?token=<WEBHOOK_SHARED_SECRET>`
3. Weka `WEBHOOK_IP_ALLOWLIST` kwa IP za AT (uliza AT orodha ya sasa). Tumia HTTPS; nyuma ya nginx weka `TRUST_PROXY=true`.

## WhatsApp
`WHATSAPP_PROVIDER=cloud` + 4 vigezo vya Meta; webhook `https://<domain>/api/v1/webhooks/whatsapp`.

## 2FA kwa wafanyakazi (TOTP)
Production: `REQUIRE_MFA_STAFF` ni *on* kwa default na haiwezi kuzimwa. Njia zote za wafanyakazi zinakataa (403
`MFA_REQUIRED`) hadi kipindi kiwe kimeingia kwa code ya authenticator. Hatua za mara ya kwanza:
`POST /auth/login` → `POST /auth/mfa/enroll` (changanua `otpauthUrl` kama QR kwenye Google Authenticator/Authy) →
`POST /auth/mfa/confirm {code}` (inarudisha token mpya). Baada ya hapo login ni `{email, password, totpCode}`.
Simu ikipotea: admin anafanya `PATCH /admin/users/:id/mfa-reset` (admin mwingine anarejeshwa na super admin tu).
Code inatumika mara moja tu. Hakuna recovery codes kwa sasa.

## Wafanyakazi wa kwanza
Responder anajisajili (`/auth/register`, anakuwa *inactive*) → admin anamwamsha: `PATCH /admin/users/:id/access`
na `{ "isActive": true, "districtCode": "KYELA", "phone": "+2557..." }`. Bila namba ya simu hapokei alerts.
Orodha ya wilaya iko `prisma/seed/districts.json`: **ihakiki** kabla ya pilot.

Docs: `docs/architecture.md`, `privacy-and-data.md`, `responder-protocol.md`, `api.md`, `review-findings.md`.
