import { randomBytes } from 'node:crypto';

// 32 symbols (no I, O, 0, 1) so `byte % 32` has no modulo bias and codes are easy to read aloud.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCaseCode(): string {
  const bytes = randomBytes(6);
  return `SL-${Array.from(bytes, (b) => ALPHABET[b % 32]).join('')}`;
}

export function normaliseCaseCode(input: string): string | null {
  const m = /^SL-?([A-Z2-9]{6})$/i.exec(input.trim());
  return m ? `SL-${m[1].toUpperCase()}` : null;
}
