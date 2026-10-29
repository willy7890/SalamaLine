import { base32Decode, base32Encode, hotp, TotpService } from '../../src/common/crypto/totp.service';

describe('TOTP (RFC 6238)', () => {
  const key = Buffer.from('12345678901234567890', 'ascii');

  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('matches the official SHA-1 test vector at t=%i', (t, expected) => {
    expect(hotp(key, Math.floor(t / 30), 8)).toBe(expected);
  });

  it('base32 round-trips', () => {
    const bytes = Buffer.from('hello world, salamaline!');
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
    expect(base32Encode(key)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'); // standard RFC secret
    expect(() => base32Decode('not*base32')).toThrow();
  });

  describe('TotpService', () => {
    const svc = new TotpService();
    const secret = svc.generateSecret();
    const now = 1_800_000_000_000;

    it('generates 160-bit secrets and an otpauth URL', () => {
      expect(secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(svc.otpauthUrl('a@b.org', secret, 'SalamaLine')).toBe(`otpauth://totp/SalamaLine%3Aa%40b.org?secret=${secret}&issuer=SalamaLine&algorithm=SHA1&digits=6&period=30`);
    });
    it('accepts the current code and +/- one step of clock drift, returning the matched step', () => {
      const step = Math.floor(now / 30000);
      expect(svc.verify(secret, svc.codeAt(secret, now), now)).toBe(step);
      expect(svc.verify(secret, svc.codeAt(secret, now - 30_000), now)).toBe(step - 1);
      expect(svc.verify(secret, svc.codeAt(secret, now + 30_000), now)).toBe(step + 1);
    });
    it('rejects older/newer codes, wrong codes and malformed input', () => {
      expect(svc.verify(secret, svc.codeAt(secret, now - 120_000), now)).toBeNull();
      expect(svc.verify(secret, svc.codeAt(secret, now + 120_000), now)).toBeNull();
      expect(svc.verify(secret, '12345', now)).toBeNull();
      expect(svc.verify(secret, 'abcdef', now)).toBeNull();
      expect(svc.verify(svc.generateSecret(), svc.codeAt(secret, now), now)).toBeNull();
    });
  });
});
