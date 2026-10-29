# What is stored, for how long

| Data | Where | Form | Removed |
|---|---|---|---|
| Girl's callback number (only if she consents) | `HelpRequest.contactEnc` | AES-256-GCM, bound to the case id | when the case is closed/cancelled, by delete-my-data (99 / FUTA), or after `CONTACT_MAX_RETENTION_DAYS` |
| Same number, for de-duplication and delete-my-data | `HelpRequest.contactHash` | HMAC-SHA256 with secret pepper | same as above |
| Outbound message recipient | `Notification.recipientEnc` | AES-256-GCM | as soon as the message is sent or abandoned |
| Staff phone (alerts, ACK/CLOSE) | `User.phoneEnc`, `User.phoneHash` | encrypted + HMAC | when an admin clears it |
| Staff 2FA secret | `User.totpSecretEnc` | AES-256-GCM, bound to the user id | when an admin resets 2FA |
| Message text from girls | **never stored** | | |
| Names, ages | **never stored** | | |
| Wellbeing answers | **never stored**; only an anonymous daily counter | | |
| Anonymous reports | case without any contact data | | |
| Webhook ids (de-duplication) | `ProcessedWebhook` | opaque ids | after 7 days |
| Audit events | `AuditEvent` | actor id, action, resource id, outcome (no content) | after `AUDIT_RETENTION_DAYS` (default 730, min 90) |
| Logs | stdout (pino) | method + path only; numbers/text/tokens redacted | per your log platform |

Who can read a girl's number: only the **assigned responder** (or the district focal person), only with consent,
only while the case is open, and every read is audited. Administrators cannot read numbers.

Honest limits to tell users: a mobile operator can still see that a number used the short code; the gateway provider
sees message content in transit. Anonymous reports are not stored with a number, but the operator may still see it.
