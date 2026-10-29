import { UssdEngine } from '../../src/channels/ussd/ussd.engine';
import { UssdPorts } from '../../src/channels/ussd/menus/types';
import { render, USSD_MAX_CHARS } from '../../src/channels/ussd/ussd.renderer';
import { I18nService } from '../../src/common/i18n/i18n.service';

const i18n = new I18nService();

function makePorts(overrides: Partial<UssdPorts> = {}, districtCount = 3) {
  const districts = Array.from({ length: districtCount }, (_, i) => ({ code: `D${i + 1}`, name: `Wilaya${i + 1}` }));
  const ports = {
    t: (lang, key, vars) => i18n.t(lang, key, vars),
    listDistricts: jest.fn(async () => districts),
    infoFor: jest.fn(async () => ({ shortText: 'Short approved text.', fullText: 'Full approved text.' })),
    services: jest.fn(async () => ['Kituo cha Afya +255700111222']),
    createHelp: jest.fn(async () => 'SL-ABC234'),
    createReport: jest.fn(async () => 'SL-RPT234'),
    sendSms: jest.fn(async () => undefined),
    deleteMyData: jest.fn(async () => undefined),
    wellbeing: jest.fn(async () => undefined),
    wellbeingTip: jest.fn(async () => 'Tip text'),
    helplineText: () => 'Helpline 116',
    metric: jest.fn(async () => undefined),
    ...overrides,
  } as UssdPorts & Record<string, jest.Mock>;
  return { ports, engine: new UssdEngine(ports) };
}

const run = (inputs: string[], p = makePorts()) => p.engine.run(inputs);

describe('USSD engine', () => {
  it('starts with the language prompt, then the main menu', async () => {
    expect((await run([])).text).toContain('Kiswahili');
    expect((await run(['1'])).text).toContain('Taarifa');
    expect((await run(['2'])).text).toContain('Information');
  });

  it('help request: nothing is created until the girl consents', async () => {
    const p = makePorts();
    const consent = await run(['1', '3', '1', '1'], p);
    expect(consent).toMatchObject({ type: 'CON' });
    expect(consent.text).toContain('Ndio');
    expect(p.ports.createHelp).not.toHaveBeenCalled();

    const done = await run(['1', '3', '1', '1', '1'], p);
    expect(done).toEqual({ type: 'END', text: expect.stringContaining('SL-ABC234') });
    expect(p.ports.createHelp).toHaveBeenCalledWith({ topic: 'CHILD_MARRIAGE', districtCode: 'D1', urgent: false, lang: 'sw' });
  });

  it('declining consent alerts nobody but still shows services', async () => {
    const p = makePorts();
    const res = await run(['1', '3', '2', '1', '2'], p);
    expect(res.type).toBe('END');
    expect(res.text).toContain('Kituo cha Afya');
    expect(p.ports.createHelp).not.toHaveBeenCalled();
  });

  it('anonymous concern report creates a report without asking for consent', async () => {
    const p = makePorts();
    const res = await run(['2', '4', '1', '1'], p);
    expect(res).toEqual({ type: 'END', text: expect.stringContaining('SL-RPT234') });
    expect(p.ports.createReport).toHaveBeenCalledWith({ topic: 'CHILD_MARRIAGE', districtCode: 'D1', lang: 'en' });
    expect(p.ports.createHelp).not.toHaveBeenCalled();
  });

  it('FGM "I am afraid I will be cut" is an urgent request after consent', async () => {
    const p = makePorts();
    await run(['1', '3', '1', '2', '1', '1'], p);
    expect(p.ports.createHelp).toHaveBeenCalledWith({ topic: 'FGM', districtCode: 'D1', urgent: true, lang: 'sw' });
  });

  it('FGM "I was cut, I need care" shows health/counselling services and raises NO alert', async () => {
    const p = makePorts();
    const screen = await run(['1', '3', '1', '2', '3'], p);
    expect(screen.type).toBe('CON');
    expect(p.ports.services).toHaveBeenCalledWith('D1', 'sw', ['CLINIC', 'COUNSELLING']);
    await run(['1', '3', '1', '2', '3', '1'], p);
    expect(p.ports.sendSms).toHaveBeenCalledTimes(1);
    expect(p.ports.createHelp).not.toHaveBeenCalled();
    expect(p.ports.createReport).not.toHaveBeenCalled();
  });

  it('FGM "I am worried about a girl" files an anonymous report', async () => {
    const p = makePorts();
    await run(['1', '3', '1', '2', '2'], p);
    expect(p.ports.createReport).toHaveBeenCalledWith({ topic: 'FGM', districtCode: 'D1', lang: 'sw' });
  });

  it('information: shows the approved short text and can send the full text by SMS', async () => {
    const p = makePorts();
    expect((await run(['1', '1', '1'], p)).text).toContain('Short approved text.');
    const sent = await run(['1', '1', '1', '1'], p);
    expect(sent.type).toBe('END');
    expect(p.ports.sendSms).toHaveBeenCalledWith('SalamaLine: Full approved text.');
  });

  it('information with no approved content says so instead of inventing text', async () => {
    const p = makePorts({ infoFor: jest.fn(async () => null) });
    expect((await run(['1', '1', '2'], p)).text).toContain('yanaandaliwa');
  });

  it('0 goes back, 00 exits, invalid input re-shows the screen with an error', async () => {
    expect((await run(['1', '3', '0'])).text).toContain('Taarifa');
    expect(await run(['1', '00'])).toEqual({ type: 'END', text: expect.stringContaining('Kwaheri') });
    const bad = await run(['1', '9']);
    expect(bad.type).toBe('CON');
    expect(bad.text).toContain('Chaguo si sahihi');
    expect(bad.text).toContain('Taarifa');
  });

  it('99 deletes the data after confirmation, from any screen', async () => {
    const p = makePorts();
    const confirm = await run(['1', '3', '99'], p);
    expect(confirm.text).toContain('Futa data');
    expect(p.ports.deleteMyData).not.toHaveBeenCalled();
    expect((await run(['1', '3', '99', '1'], p)).type).toBe('END');
    expect(p.ports.deleteMyData).toHaveBeenCalledTimes(1);
  });

  it('wellbeing: good answer gives a tip and stores only an anonymous level', async () => {
    const p = makePorts();
    expect(await run(['1', '5', '1'], p)).toEqual({ type: 'END', text: 'Tip text' });
    expect(p.ports.wellbeing).toHaveBeenCalledWith('good');
  });

  it('wellbeing: low answer shows the helpline FIRST, then offers a counsellor only if she agrees', async () => {
    const p = makePorts();
    const low = await run(['2', '5', '3'], p);
    expect(low.type).toBe('CON');
    expect(low.text.startsWith('Helpline 116')).toBe(true); // helpline is the first thing shown
    expect(p.ports.createHelp).not.toHaveBeenCalled();
    const done = await run(['2', '5', '3', '1', '1', '1'], p);
    expect(done.type).toBe('END');
    expect(p.ports.createHelp).toHaveBeenCalledWith({ topic: 'WELLBEING', districtCode: 'D1', urgent: false, lang: 'en' });
  });

  it('paginates long district lists', async () => {
    const p = makePorts({}, 8);
    const first = await run(['1', '2'], p);
    expect(first.text).toContain('8 Zaidi');
    const second = await run(['1', '2', '8'], p);
    expect(second.text).toContain('Wilaya7');
    expect(second.text).not.toContain('Wilaya1\n');
  });

  it('every screen fits one USSD message (<= 182 chars) after rendering', async () => {
    const paths = [[], ['1'], ['2'], ['1', '1'], ['1', '2'], ['1', '3'], ['1', '3', '1'], ['1', '3', '1', '2'], ['1', '3', '1', '1'], ['1', '5'], ['1', '5', '3'], ['1', '1', '1'], ['1', '3', '99'], ['2', '3', '1'], ['2', '3', '1', '2']];
    for (const path of paths) expect(render(await run(path)).length).toBeLessThanOrEqual(USSD_MAX_CHARS);
  });

  it('replaying the same inputs twice has no side effects before the final step', async () => {
    const p = makePorts();
    await run(['1', '3', '1', '1'], p);
    await run(['1', '3', '1', '1'], p);
    expect(p.ports.createHelp).not.toHaveBeenCalled();
    expect(p.ports.sendSms).not.toHaveBeenCalled();
  });
});

describe('USSD renderer', () => {
  it('prefixes CON/END and truncates over-long text', () => {
    expect(render({ type: 'CON', text: 'hi' })).toBe('CON hi');
    expect(render({ type: 'END', text: 'x'.repeat(500) }).length).toBe(USSD_MAX_CHARS);
  });
});
