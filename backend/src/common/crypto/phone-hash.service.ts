import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { ENV, Env } from '../../config/config.module';
import { normalizePhone } from '../utils/phone';

/**
 * Keyed hash (HMAC-SHA256) of a phone number. A plain SHA-256 of a phone number can be brute-forced in
 * minutes because the number space is tiny; the secret pepper (kept outside the database) prevents that.
 */
@Injectable()
export class PhoneHashService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  hash(phone: string): string {
    const normalised = normalizePhone(phone);
    if (!normalised) throw new Error('Invalid phone number');
    return createHmac('sha256', this.env.CONTACT_HASH_SECRET).update(`phone:${normalised}`).digest('hex');
  }

  /** Keyed hash of an arbitrary value within a named scope (e.g. login lockout keys). */
  hashScoped(scope: string, value: string): string {
    return createHmac('sha256', this.env.CONTACT_HASH_SECRET).update(`${scope}:${value}`).digest('hex');
  }
}
