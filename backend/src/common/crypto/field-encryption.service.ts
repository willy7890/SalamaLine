import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ENV, Env } from '../../config/config.module';

/**
 * AES-256-GCM field encryption. Format: `v<keyVersion>.<iv>.<tag>.<ciphertext>` (base64url).
 * `aad` binds a ciphertext to its context (e.g. "help-request:<id>") so it cannot be moved to another row.
 */
@Injectable()
export class FieldEncryptionService {
  private readonly keys = new Map<number, Buffer>();
  private readonly currentVersion: number;

  constructor(@Inject(ENV) env: Env) {
    this.currentVersion = env.CONTACT_ENC_KEY_VERSION;
    this.keys.set(env.CONTACT_ENC_KEY_VERSION, Buffer.from(env.CONTACT_ENC_KEY, 'base64'));
    if (env.CONTACT_ENC_KEY_PREVIOUS && env.CONTACT_ENC_KEY_PREVIOUS_VERSION) {
      this.keys.set(env.CONTACT_ENC_KEY_PREVIOUS_VERSION, Buffer.from(env.CONTACT_ENC_KEY_PREVIOUS, 'base64'));
    }
  }

  encrypt(plaintext: string, aad: string): string {
    const key = this.keys.get(this.currentVersion)!;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(aad));
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v${this.currentVersion}.${iv.toString('base64url')}.${tag.toString('base64url')}.${ct.toString('base64url')}`;
  }

  decrypt(payload: string, aad: string): string {
    const [ver, ivB64, tagB64, ctB64] = payload.split('.');
    const key = this.keys.get(Number((ver ?? '').replace(/^v/, '')));
    if (!key || !ivB64 || !tagB64 || !ctB64) throw new Error('Unreadable ciphertext');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8');
  }
}
