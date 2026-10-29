import { createHash, timingSafeEqual } from 'node:crypto';

/** Uppercases, strips accents/punctuation and collapses whitespace to underscores ("Mbeya City" -> "MBEYA_CITY"). */
export function toCode(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Constant-time string comparison (compares fixed-length digests, so length does not leak). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
