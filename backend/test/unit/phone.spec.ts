import { normalizePhone } from '../../src/common/utils/phone';
import { toCode } from '../../src/common/utils/text';

describe('normalizePhone', () => {
  it.each([
    ['0712345678', '+255712345678'],
    ['+255 712 345 678', '+255712345678'],
    ['255712345678', '+255712345678'],
    ['712345678', '+255712345678'],
    ['00255712345678', '+255712345678'],
    ['+254712345678', '+254712345678'],
  ])('%s -> %s', (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it.each(['', 'abc', '0712', '+25571234', '+2557123456789012', null, undefined])('rejects %p', (input) =>
    expect(normalizePhone(input as string)).toBeNull(),
  );
});

describe('toCode', () => {
  it('normalises district names', () => {
    expect(toCode('Mbeya City')).toBe('MBEYA_CITY');
    expect(toCode('  jiji-la mbeya ')).toBe('JIJI_LA_MBEYA');
  });
});
