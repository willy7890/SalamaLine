/**
 * Terminal USSD simulator against a locally running API:  npm run simulate:ussd -- +255712345678
 * Type menu choices; the simulator builds the accumulated "1*2*1" text exactly like Africa's Talking does.
 */
import 'dotenv/config';
import * as readline from 'node:readline/promises';

async function main() {
  const phone = process.argv[2] ?? '+255700000000';
  const base = process.env.SIM_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}/${process.env.API_PREFIX ?? 'api/v1'}`;
  const sessionId = `sim-${Date.now()}`;
  const inputs: string[] = [];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  for (;;) {
    const res = await fetch(`${base}/webhooks/ussd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(process.env.WEBHOOK_SHARED_SECRET ? { 'x-webhook-secret': process.env.WEBHOOK_SHARED_SECRET } : {}) },
      body: new URLSearchParams({ sessionId, serviceCode: '*123#', phoneNumber: phone, networkCode: '00', text: inputs.join('*') }),
    });
    const text = await res.text();
    console.log(`\n${text}\n`);
    if (!res.ok || text.startsWith('END')) break;
    inputs.push((await rl.question('> ')).trim());
  }
  rl.close();
}
void main();
