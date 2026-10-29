import { createHash, randomBytes } from 'node:crypto';
import { FieldEncryptionService } from '../../src/common/crypto/field-encryption.service';
import { PhoneHashService } from '../../src/common/crypto/phone-hash.service';
import { testEnv } from '../helpers';

describe('PhoneHashService', () => {
  const svc = new PhoneHashService(testEnv());

  it('is deterministic and format-insensitive', () => {
    expect(svc.hash('0712345678')).toBe(svc.hash('+255712345678'));
  });
  it('differs per number', () => {
    expect(svc.hash('0712345678')).not.toBe(svc.hash('0712345679'));
  });
  it('is keyed: not the plain SHA-256 an attacker could brute-force offline', () => {
    const plain = createHash('sha256').update('+255712345678').digest('hex');
    expect(svc.hash('0712345678')).not.toBe(plain);
    const other = new PhoneHashService(testEnv({ CONTACT_HASH_SECRET: 'z'.repeat(40) }));
    expect(other.hash('0712345678')).not.toBe(svc.hash('0712345678'));
  });
  it('rejects invalid numbers', () => expect(() => svc.hash('nope')).toThrow());
});

describe('FieldEncryptionService', () => {
  const svc = new FieldEncryptionService(testEnv());

  it('round-trips and uses a fresh IV each time', () => {
    const a = svc.encrypt('+255712345678', 'ctx:1');
    const b = svc.encrypt('+255712345678', 'ctx:1');
    expect(a).not.toBe(b);
    expect(a).not.toContain('255712345678');
    expect(svc.decrypt(a, 'ctx:1')).toBe('+255712345678');
  });
  it('binds ciphertext to its context (AAD)', () => {
    expect(() => svc.decrypt(svc.encrypt('secret', 'ctx:1'), 'ctx:2')).toThrow();
  });
  it('detects tampering', () => {
    const [v, iv, tag, ct] = svc.encrypt('secret', 'c').split('.');
    const flipped = Buffer.from(ct, 'base64url');
    flipped[0] ^= 1;
    expect(() => svc.decrypt([v, iv, tag, flipped.toString('base64url')].join('.'), 'c')).toThrow();
  });
  it('still decrypts old ciphertexts after key rotation', () => {
    const oldKey = randomBytes(32).toString('base64');
    const oldSvc = new FieldEncryptionService(testEnv({ CONTACT_ENC_KEY: oldKey, CONTACT_ENC_KEY_VERSION: '1' }));
    const ct = oldSvc.encrypt('rotating', 'c');
    const newSvc = new FieldEncryptionService(
      testEnv({ CONTACT_ENC_KEY_VERSION: '2', CONTACT_ENC_KEY_PREVIOUS: oldKey, CONTACT_ENC_KEY_PREVIOUS_VERSION: '1' }),
    );
    expect(newSvc.decrypt(ct, 'c')).toBe('rotating');
    expect(newSvc.encrypt('x', 'c').startsWith('v2.')).toBe(true);
  });
  it('refuses unknown key versions', () => {
    expect(() => svc.decrypt('v9.aaaa.bbbb.cccc', 'c')).toThrow();
  });
});
