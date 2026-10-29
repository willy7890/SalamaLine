import { ConversationService } from '../../src/channels/conversation.service';
import { PhoneHashService } from '../../src/common/crypto/phone-hash.service';
import { I18nService } from '../../src/common/i18n/i18n.service';
import { MemoryKvStore } from '../../src/infrastructure/redis/memory-kv.store';
import { testEnv } from '../helpers';

const SENDER = '+255712345678';

function setup(envOver: Record<string, string> = {}) {
  const env = testEnv({ HELPLINE_NUMBER: '116', ...envOver });
  const deps = {
    districts: { resolve: jest.fn(async (t?: string) => (t && /^kyela$/i.test(t) ? { code: 'KYELA' } : null)) },
    directory: { formatForSms: jest.fn(async () => ['Kituo cha Afya +255700111222']) },
    info: { getForTopic: jest.fn(async () => ({ fullText: 'Full approved text.' })) },
    requests: { create: jest.fn(async (_input: unknown) => ({ caseCode: 'SL-ABC234' })) },
    privacy: { deleteByPhone: jest.fn(async (_phone: string) => ({})) },
    responders: { identify: jest.fn(async (_p: string): Promise<unknown> => null), ack: jest.fn(async () => 'acked'), close: jest.fn(async () => 'closed') },
    wellbeing: { record: jest.fn((_l: string, _c: string) => undefined), tipText: jest.fn(async () => 'Tip text'), helplineText: jest.fn(() => 'Helpline 116 first') },
    metrics: { increment: jest.fn() },
  };
  const kv = new MemoryKvStore();
  const svc = new ConversationService(new PhoneHashService(env), new I18nService(), deps.districts as never, deps.directory as never, deps.info as never, deps.requests as never, deps.privacy as never, deps.responders as never, deps.wellbeing as never, deps.metrics as never, kv, env);
  return { svc, deps, kv };
}

const send = (s: ReturnType<typeof setup>, text: string, from = SENDER) => s.svc.handle('SMS', from, text);

describe('ConversationService (SMS/WhatsApp)', () => {
  it('MSAADA asks for consent first and creates nothing yet', async () => {
    const s = setup();
    const [reply] = await send(s, 'MSAADA Kyela');
    expect(reply).toContain('NDIO');
    expect(s.deps.requests.create).not.toHaveBeenCalled();
  });

  it('NDIO creates the request with her number and consent, and the reply reveals nothing about the topic', async () => {
    const s = setup();
    await send(s, 'FGM Kyela');
    const [reply] = await send(s, 'NDIO');
    expect(s.deps.requests.create).toHaveBeenCalledWith(expect.objectContaining({ kind: 'SELF_HELP', topic: 'FGM', districtCode: 'KYELA', priority: 'URGENT', contact: SENDER, consent: true, channel: 'SMS' }));
    expect(reply).toContain('SL-ABC234');
    expect(reply).not.toMatch(/FGM|ndoa|marriage|ukeketaji/i);
  });

  it('HAPANA alerts nobody but still returns nearby services', async () => {
    const s = setup();
    await send(s, 'MSAADA Kyela');
    const replies = await send(s, 'HAPANA');
    expect(s.deps.requests.create).not.toHaveBeenCalled();
    expect(replies.join('\n')).toContain('Kituo cha Afya');
  });

  it('a consent reply with nothing pending (or after it expired) creates nothing', async () => {
    const s = setup();
    const [reply] = await send(s, 'NDIO');
    expect(reply).toContain('Muda umekwisha');
    expect(s.deps.requests.create).not.toHaveBeenCalled();
  });

  it('a consent answer cannot be replayed to create a second request', async () => {
    const s = setup();
    await send(s, 'MSAADA Kyela');
    await send(s, 'NDIO');
    await send(s, 'NDIO');
    expect(s.deps.requests.create).toHaveBeenCalledTimes(1);
  });

  it('RIPOTI files an anonymous report: the sender number is never passed on', async () => {
    const s = setup();
    const [reply] = await send(s, 'RIPOTI Kyela NDOA');
    const arg = s.deps.requests.create.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(arg).toMatchObject({ kind: 'THIRD_PARTY_REPORT', topic: 'CHILD_MARRIAGE', consent: false });
    expect(JSON.stringify(arg)).not.toContain('712345678');
    expect(arg.contact).toBeUndefined();
    expect(reply).toContain('SL-ABC234');
  });

  it('unknown district gets a helpful message, not an error', async () => {
    const s = setup();
    expect((await send(s, 'KLINIKI Atlantis'))[0]).toContain('Wilaya haijulikani');
    expect((await send(s, 'MSAADA'))[0]).toContain('Wilaya haijulikani');
  });

  it('FUTA deletes the sender\'s data', async () => {
    const s = setup();
    await send(s, 'FUTA');
    expect(s.deps.privacy.deleteByPhone).toHaveBeenCalledWith(SENDER);
  });

  it('staff ACK from an unrecognised number looks like any unknown text (staff are not revealed)', async () => {
    const s = setup();
    const [reply] = await send(s, 'ACK SL-ABC234');
    expect(reply).toContain('Haieleweki');
    expect(s.deps.responders.ack).not.toHaveBeenCalled();
  });

  it('staff ACK / CLOSE from a registered responder is handled', async () => {
    const s = setup();
    s.deps.responders.identify.mockResolvedValue({ id: 'u1' });
    expect(await send(s, 'ACK SL-ABC234')).toEqual(['acked']);
    expect(await send(s, 'CLOSE SL-ABC234')).toEqual(['closed']);
  });

  it('wellbeing check-in: low answer shows the helpline first and stores only an anonymous level', async () => {
    const s = setup();
    expect((await send(s, 'USTAWI'))[0]).toContain('Umejisikiaje');
    expect(await send(s, '3')).toEqual(['Helpline 116 first']);
    expect(s.deps.wellbeing.record).toHaveBeenCalledWith('low', 'SMS');
  });

  it('a bare digit with nothing pending is not treated as a wellbeing answer', async () => {
    const s = setup();
    expect((await send(s, '3'))[0]).toContain('Haieleweki');
    expect(s.deps.wellbeing.record).not.toHaveBeenCalled();
  });

  it('INFO answers only from approved content', async () => {
    const s = setup();
    expect((await send(s, 'TAARIFA NDOA'))[0]).toContain('Full approved text.');
    s.deps.info.getForTopic.mockResolvedValue(null as never);
    expect((await send(s, 'TAARIFA NDOA'))[0]).toContain('yanaandaliwa');
  });

  it('rate-limits a single sender', async () => {
    const s = setup();
    let last: string[] = [];
    for (let i = 0; i < 31; i++) last = await send(s, 'SALAMA');
    expect(last[0]).toContain('Maombi mengi');
  });

  it('English commands get English replies', async () => {
    const s = setup();
    expect((await send(s, 'HELP kyela'))[0]).toContain('Reply YES or NO');
  });
});
