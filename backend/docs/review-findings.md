# Review of the uploaded SalamaLine_Backend.zip

## Bugs and risks found in the original code, and what was done

| # | Finding | Now |
|---|---|---|
| 1 | `start:prod` / Docker `CMD` pointed at `dist/main`, but the build wrote `dist/src/main.js` (seed file widened `rootDir`) | `tsconfig.build.json` builds only `src/`; `dist/main.js` verified |
| 2 | Contact numbers hashed with plain SHA-256 (brute-forceable) and the encrypted column was never used, so no responder could ever call a girl back | HMAC-SHA256 with secret pepper + AES-256-GCM encrypted callback number, wiped on close |
| 3 | No alerting or escalation at all (the core promise of the proposal) | Outbox + escalation service + worker process |
| 4 | A responder with no district could list cases from **every** district | Refused (403); responders are district-scoped |
| 5 | Any responder could change the status of any case in any district | District + assignee checks, valid-transition rules, audited |
| 6 | The public API let the caller choose `channel` (could claim `STAFF`) | Public API is always `WEB`; other channels only arrive via their webhooks |
| 7 | Hardcoded super-admin e-mail and a fallback JWT secret in source | `SUPER_ADMIN_EMAIL` env; startup fails on missing/weak/placeholder secrets |
| 8 | `.env` (with an admin password entry) was inside the zip | Excluded. **Rotate that password and any key that was in it.** |
| 9 | Login timing leaked which e-mails exist; no lockout | Dummy-hash compare, 5-failure lockout |
| 10 | JWT not pinned to an algorithm/issuer/audience | HS256 + issuer + audience |
| 11 | Audit service existed but was never called | Called on login, case actions, contact reads, content/service/admin changes |
| 12 | Content could be approved by its own author; approved content never expired | Four-eyes rule; review-due date; expired content is not served |
| 13 | Swagger always on; Docker ran as root with `npm install` | Off in production by default; non-root, `npm ci`, multi-stage |
| 14 | TypeScript `strict` off; e2e test could not compile (`supertest` import) | `strict` on; tests rewritten |
| 15 | Metrics table had nullable unique columns (upsert would duplicate rows) | `districtCode` defaults to `ALL` |

## Added (was missing)
USSD, SMS and WhatsApp channels; gateways (Africa's Talking, WhatsApp Cloud, fake); consent flow; anonymous reports;
FGM paths; wellbeing check-in; delete-my-data; escalation/outbox/retention jobs; districts; service-directory
verification and expiry; partner dashboard with suppression; staff phone + ACK/CLOSE by SMS; request-id logging with
redaction; health/readiness; Docker, compose, CI; 161 automated tests.

## Added in v1.2
Staff 2FA (TOTP, RFC 6238, verified against the official test vectors; single-use codes; required in production),
password change, Redis-backed rate limiting shared across API instances, audit-log retention, admin 2FA reset.

## Verified here vs NOT verified here
Verified: TypeScript strict compile, ESLint, `nest build`, 161 tests including a boot of the **real** module graph
(API and worker) with only the database stubbed.
**Not run in this environment (no database or network to Meta/Africa's Talking):** `prisma migrate`, any real SQL,
Redis, Docker build, real SMS/WhatsApp sends. The first real run on your machine is the real test. Expect to fix small
things; start with the steps in README.md and the sandbox/test numbers of Africa's Talking.

## Decisions that are yours, not the code's
Verified helpline number; real district list; service directory content (nothing invented is seeded); consent wording;
Swahili wording (placeholders, needs native-speaker and professional review); retention periods; audit-log retention;
whether to use WhatsApp templates; independent privacy and safeguarding review before any pilot (as the proposal says).
