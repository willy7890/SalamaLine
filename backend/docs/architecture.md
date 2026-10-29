# Architecture

```
 girl's phone ──USSD/SMS/WhatsApp──▶ gateway (Africa's Talking / Meta)
                                         │ webhook (secret / signature, idempotent)
                                         ▼
 ┌──────────────── API process (dist/main) ─────────────────┐        ┌────── worker (dist/worker) ──────┐
 │ channels/  ussd · sms · whatsapp   (parse → Intent)       │        │ jobs/escalation   every minute    │
 │      │                                                    │        │ jobs/notification every 10 s      │
 │      ▼                                                    │        │ jobs/retention    hourly          │
 │ modules/  help-requests · info · directory · privacy ·    │        └──────────────┬────────────────────┘
 │           wellbeing · responders · dashboard · admin      │                       │
 │      │                                                    │                       │
 │      ▼        NotificationsService (outbox) ──────────────┼──────▶ PostgreSQL ◀───┘
 │ gateways/ africastalking · whatsapp-cloud · fake          │         Redis (rate limits, lockouts, consent prompts)
 └───────────────────────────────────────────────────────────┘
```

**Layers:** controller → service → Prisma. `channels/` never contains business rules; it turns a message into an
`Intent` and calls a module. `gateways/` hides the provider; `fake` is used in tests/dev.

**Why two processes:** the API must answer a USSD callback in seconds. Escalation, delivery retries and retention run
in `worker` so they never compete with callbacks, and a restart of either loses nothing: all state is in PostgreSQL.

**"A trained human is always behind every request"** is implemented by `EscalationService`:
case created → responders alerted → reminder every `ESCALATION_REMINDER_MINUTES` → after
`ESCALATION_REMINDERS_BEFORE_FOCAL` reminders the district focal person → administrators if nobody else has a phone.
A case nobody can be told about is written to the audit log (`ALERT_NO_RECIPIENTS`) and logged at ERROR.

**USSD** is a stateless replay machine (see `channels/ussd/ussd.engine.ts`): Africa's Talking sends the whole path
(`1*3*2`), so no session data about the person is stored. Other USSD providers that do not send the accumulated
path would need a Redis session store (not implemented).

**Delivery is at-least-once** (outbox + lease). A crash after the provider accepts a message but before we record it
can produce one duplicate SMS. That is the intended trade-off for safeguarding alerts.

**Scaling limits to know about:** the HTTP throttler store is per-process (add a Redis store before running several API
instances); WhatsApp free-form replies only work inside Meta's 24-hour window (templates are not implemented).
