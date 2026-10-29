import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { safeEqual } from '../utils/text';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of input.replace(/=+$/, '').toUpperCase()) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** RFC 4226 HOTP (HMAC-SHA1, dynamic truncation). */
export function hotp(key: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(msg).digest();
  const offset = h[h.length - 1] & 0xf;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

/** RFC 6238 TOTP (30 s steps, 6 digits), compatible with Google Authenticator, Authy, Microsoft Authenticator. */
@Injectable()
export class TotpService {
  generateSecret(): string {
    return base32Encode(randomBytes(20));
  }

  otpauthUrl(account: string, secret: string, issuer: string): string {
    const label = encodeURIComponent(`${issuer}:${account}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
  }

  codeAt(secret: string, timeMs: number): string {
    return hotp(base32Decode(secret), Math.floor(timeMs / 1000 / STEP_SECONDS));
  }

  /**
   * Returns the matched time step (for replay protection) or null. Accepts +/- `window` steps to tolerate clock drift.
   * Every candidate is compared in constant time and none short-circuits.
   */
  verify(secret: string, code: string, nowMs = Date.now(), window = 1): number | null {
    if (!/^\d{6}$/.test(code)) return null;
    const key = base32Decode(secret);
    const current = Math.floor(nowMs / 1000 / STEP_SECONDS);
    let matched: number | null = null;
    for (let w = -window; w <= window; w++) {
      if (safeEqual(hotp(key, current + w), code) && matched === null) matched = current + w;
    }
    return matched;
  }
}
