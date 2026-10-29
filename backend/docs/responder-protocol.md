# Responder protocol (placeholder for partner-approved text)

Alert SMS: `SalamaLine: New case SL-XXXXXX (TOPIC) DISTRICT [URGENT]. Reply ACK SL-XXXXXX to accept.`

1. Reply `ACK SL-XXXXXX` from your registered phone. The first responder to reply gets the case; others' queued alerts are cancelled.
2. If the girl agreed to contact, open the case in the app (`GET /help-requests/:id/contact`). The read is logged.
3. Confirm it is safe to talk. Do **not** contact the family without a safety plan. The system never contacts police, family or authorities by itself.
4. Refer to verified services (`POST /help-requests/:id/referrals`).
5. Reply `CLOSE SL-XXXXXX` (or use the app). Closing wipes the contact details.

If nobody accepts, reminders repeat and then the district focal person is alerted. Replace this text with the protocol your child-protection partners approve.
