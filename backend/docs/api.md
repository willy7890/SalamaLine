# API (prefix `/api/v1`, Swagger at `/docs` when enabled)

| Method & path | Who | Notes |
|---|---|---|
| `GET /health`, `GET /health/ready` | public | ready checks DB + Redis, shows provider modes |
| `GET /districts` | public | active districts |
| `GET /content?language&topic` | public | **approved, unexpired content only** |
| `GET /services?district&type` | public | **active, verified, unexpired entries only** |
| `POST /help-requests` | public (5/min/IP) | channel is always `WEB`; contact only with `consentToContact: true` |
| `POST /help-requests/reports` | public (10/min/IP) | anonymous concern, no contact accepted |
| `POST /auth/register` · `POST /auth/login` · `GET /auth/me` | public / token | register creates an **inactive** account; 5 failed logins = 15 min lock |
| `POST /auth/mfa/enroll` · `POST /auth/mfa/confirm` | any signed-in staff | 2FA setup: returns secret + `otpauth://` URL (QR), then confirm with the first code; confirm returns a token with the 2FA claim |
| `POST /auth/change-password` | signed-in | needs current password; 5 wrong attempts = 15 min lock |
| `GET /help-requests` | staff | district-scoped (admins can filter) |
| `POST /help-requests/:id/accept` | responder, focal | first responder wins |
| `GET /help-requests/:id/contact` | assignee / focal | consent required, audited, admins excluded |
| `PATCH /help-requests/:id/status` | assignee / focal / admin | `IN_PROGRESS`, `REFERRED`, `CLOSED`, `CANCELLED`; closing wipes contact |
| `POST /help-requests/:id/referrals` | assignee / focal | optional `serviceEntryId`, `consentGranted` |
| `GET /content/admin/all` · `POST /content` · `POST /content/:id/review` | admin, content reviewer | author cannot approve own text; approval sets a review-due date (default 12 months) |
| `POST /services` · `POST /services/:id/activate` · `…/deactivate` | admin | entries start inactive; need named verifying org + person |
| `GET /admin/users` · `PATCH /admin/users/:id/access` · `PATCH /admin/users/:id/mfa-reset` · `POST /admin/districts` | admin | only the super admin grants ADMIN or resets an admin's 2FA |
| `GET /dashboard/summary?from&to` | admin, partner analyst | small counts (< `SMALL_COUNT_THRESHOLD`) removed server-side |
| `POST /webhooks/ussd` | gateway | form: `sessionId, phoneNumber, text`; header `x-webhook-secret` or `?token=` |
| `POST /webhooks/sms` | gateway | form: `from, text, id`; same secret |
| `GET/POST /webhooks/whatsapp` | Meta | verify token + `X-Hub-Signature-256` |

SMS commands: `SALAMA`, `KLINIKI <wilaya>`, `MSAADA <wilaya> [mada]`, `FGM <wilaya>`, `RIPOTI <wilaya> [mada]`,
`TAARIFA <mada>`, `USTAWI`, `FUTA`, `NDIO`/`HAPANA` (English aliases work). Responders: `ACK <code>`, `CLOSE <code>`.
USSD: `0` back, `00` exit, `99` delete my data.

**Login with 2FA:** `POST /auth/login {email, password, totpCode?}`. When 2FA is enabled and `totpCode` is missing the
API answers `401 {code: "MFA_REQUIRED"}` (only after the password was right). A code works once. With
`REQUIRE_MFA_STAFF` on (default in production) every staff route answers `403 {code: "MFA_REQUIRED"}` until the
session was authenticated with a code; the login response has `mfaSetupRequired: true` for accounts that must enrol.
