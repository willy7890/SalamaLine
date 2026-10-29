import { parseMessage } from '../../src/channels/sms/sms.parser';
import { splitMessage } from '../../src/channels/sms/sms.splitter';

describe('parseMessage', () => {
  it('parses menu and Swahili commands', () => {
    expect(parseMessage('salama').intent).toEqual({ type: 'MENU' });
    expect(parseMessage('KLINIKI Mbeya City').intent).toEqual({ type: 'FIND_SERVICES', district: 'Mbeya City' });
    expect(parseMessage('USTAWI').intent).toEqual({ type: 'WELLBEING' });
    expect(parseMessage('futa').intent).toEqual({ type: 'DELETE_MY_DATA' });
  });
  it('FGM is an urgent FGM help request', () => {
    expect(parseMessage('FGM Kyela').intent).toEqual({ type: 'REQUEST_HELP', district: 'Kyela', topic: 'FGM', urgent: true });
  });
  it('splits an optional trailing topic from a multi-word district', () => {
    expect(parseMessage('MSAADA Mbeya City NDOA').intent).toEqual({ type: 'REQUEST_HELP', district: 'Mbeya City', topic: 'CHILD_MARRIAGE' });
    expect(parseMessage('RIPOTI Kyela').intent).toEqual({ type: 'REPORT_CONCERN', district: 'Kyela', topic: 'OTHER' });
  });
  it('understands English aliases and sets the language', () => {
    expect(parseMessage('HELP kyela')).toMatchObject({ lang: 'en', intent: { type: 'REQUEST_HELP', district: 'kyela' } });
    expect(parseMessage('YES').intent).toEqual({ type: 'CONSENT_REPLY', granted: true });
    expect(parseMessage('hapana').intent).toEqual({ type: 'CONSENT_REPLY', granted: false });
  });
  it('parses responder ACK/CLOSE and ignores a bare ACK', () => {
    expect(parseMessage('ack sl-abc234').intent).toEqual({ type: 'STAFF_ACK', caseCode: 'SL-ABC234' });
    expect(parseMessage('CLOSE SL-ABC234').intent).toEqual({ type: 'STAFF_CLOSE', caseCode: 'SL-ABC234' });
    expect(parseMessage('ACK').intent).toEqual({ type: 'UNKNOWN' });
  });
  it('handles digits and garbage', () => {
    expect(parseMessage('2').intent).toEqual({ type: 'CHOICE', value: '2' });
    expect(parseMessage('   ').intent).toEqual({ type: 'UNKNOWN' });
    expect(parseMessage('hello there').intent).toEqual({ type: 'UNKNOWN' });
  });
});

describe('splitMessage', () => {
  it('keeps short text whole', () => expect(splitMessage('hello')).toEqual(['hello']));
  it('splits at word boundaries within the limit', () => {
    const parts = splitMessage('word '.repeat(150), 100, 10);
    expect(parts.length).toBeGreaterThan(1);
    parts.forEach((p) => expect(p.length).toBeLessThanOrEqual(100));
  });
  it('caps the number of parts and marks truncation', () => {
    const parts = splitMessage('word '.repeat(500), 100, 3);
    expect(parts).toHaveLength(3);
    expect(parts[2].endsWith('…')).toBe(true);
  });
});
