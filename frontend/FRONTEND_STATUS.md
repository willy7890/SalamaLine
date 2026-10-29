# PesaTrack frontend demo status

## Interactions available in this frontend
- Bilingual English/Swahili landing page and theme switcher.
- Animated welcome message and responsive landing sections.
- Start/plan buttons open the demo workspace flow rather than a “coming soon” toast.
- Demo workspace form with client-side validation.
- Add manual/demo bank, mobile-money or cash account labels and opening balances.
- Add sample income and expense transactions; summary totals update in the browser.
- Pesa AI chat gives keyword-based general demo guidance and clearly says it is not reading real financial data.
- Privacy/demo notice explains the current limits.

## Important production boundary
This is a frontend-only prototype. It does not create secure user accounts, store passwords, connect to real bank/mobile-money APIs, process subscriptions, or send messages to a real AI model. Do not enter sensitive financial information. Production requires a backend, authentication, database, authorization checks, payment provider and official financial-provider API access. Bank PINs and OTPs must never be collected by this frontend.

## Run locally
```bash
npm install
npm run dev
```

Use the localhost URL printed by Vite.
