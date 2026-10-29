import { EscalationService } from '../../src/modules/help-requests/escalation.service';
import { AlertService } from '../../src/modules/help-requests/alert.service';
import { testEnv } from '../helpers';

const NOW = new Date('2026-10-24T10:00:00Z');
const due = (over = {}) => ({ id: 'r1', caseCode: 'SL-AAAAAA', topic: 'FGM', districtCode: 'KYELA', priority: 'URGENT', status: 'PENDING', escalationCount: 0, lastAlertAt: new Date('2026-10-24T09:00:00Z'), escalatedAt: null, createdAt: new Date('2026-10-24T08:00:00Z'), ...over });

function setup(rows: unknown[], claim = 1) {
  const prisma = { helpRequest: { findMany: jest.fn().mockResolvedValue(rows), updateMany: jest.fn().mockResolvedValue({ count: claim }) } };
  const alerts = { alert: jest.fn().mockResolvedValue(1) };
  const svc = new EscalationService(prisma as never, alerts as never, testEnv({ ESCALATION_REMINDER_MINUTES: '10', ESCALATION_REMINDERS_BEFORE_FOCAL: '2' }));
  return { prisma, alerts, svc };
}

describe('EscalationService', () => {
  it('only looks at PENDING cases whose last alert is older than the reminder interval (or that were never alerted)', async () => {
    const { prisma, svc } = setup([]);
    await svc.runOnce(NOW);
    const where = prisma.helpRequest.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('PENDING');
    expect(where.OR).toEqual([{ lastAlertAt: { lte: new Date('2026-10-24T09:50:00Z') } }, { lastAlertAt: null, createdAt: { lte: new Date('2026-10-24T09:50:00Z') } }]);
  });

  it('re-alerts responders first, then escalates to the focal person after the configured reminders', async () => {
    const { alerts, svc } = setup([due({ id: 'a', escalationCount: 0 }), due({ id: 'b', escalationCount: 1 }), due({ id: 'c', escalationCount: 2 })]);
    const res = await svc.runOnce(NOW);
    expect(alerts.alert.mock.calls.map((c) => c[1])).toEqual(['reminder', 'reminder', 'escalation']);
    expect(res).toEqual({ examined: 3, alerted: 3, escalated: 1 });
  });

  it('claims each case with compare-and-set so two workers never double-alert', async () => {
    const lost = setup([due()], 0);
    expect((await lost.svc.runOnce(NOW)).alerted).toBe(0);
    expect(lost.alerts.alert).not.toHaveBeenCalled();

    const won = setup([due()], 1);
    await won.svc.runOnce(NOW);
    const call = won.prisma.helpRequest.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ id: 'r1', status: 'PENDING', lastAlertAt: new Date('2026-10-24T09:00:00Z') });
    expect(call.data).toMatchObject({ lastAlertAt: NOW, escalationCount: { increment: 1 } });
  });

  it('records the first escalation time', async () => {
    const { prisma, svc } = setup([due({ escalationCount: 2 })]);
    await svc.runOnce(NOW);
    expect(prisma.helpRequest.updateMany.mock.calls[0][0].data.escalatedAt).toEqual(NOW);
  });

  it('recovers a case created but never alerted (crash between create and alert)', async () => {
    const { alerts, svc } = setup([due({ lastAlertAt: null })]);
    await svc.runOnce(NOW);
    expect(alerts.alert).toHaveBeenCalledTimes(1);
  });
});

describe('AlertService', () => {
  const staff = (id: string) => ({ id, phoneEnc: 'x' });
  function make(byRole: Record<string, unknown[]>) {
    const prisma = { user: { findMany: jest.fn(async ({ where }) => byRole[where.role.in[0]] ?? []) } };
    const crypto = { decrypt: jest.fn(() => '+255700000001') };
    const notifications = { enqueueAndKick: jest.fn().mockResolvedValue('n1') };
    const audit = { record: jest.fn() };
    return { prisma, notifications, audit, svc: new AlertService(prisma as never, crypto as never, notifications as never, audit as never) };
  }
  const target = { id: 'r1', caseCode: 'SL-AAAAAA', topic: 'FGM', districtCode: 'KYELA', priority: 'URGENT' } as never;

  it('alerts district responders and puts only case code, topic and district in the SMS', async () => {
    const { svc, notifications } = make({ RESPONDER: [staff('s1'), staff('s2')] });
    expect(await svc.alert(target, 'initial')).toBe(2);
    const body = notifications.enqueueAndKick.mock.calls[0][0].body as string;
    expect(body).toContain('SL-AAAAAA');
    expect(body).toContain('ACK');
    expect(body).toContain('URGENT');
  });
  it('falls back to the focal person, then administrators, so a case is never left with nobody to tell', async () => {
    expect(await make({ DISTRICT_FOCAL: [staff('f')] }).svc.alert(target, 'initial')).toBe(1);
    expect(await make({ ADMIN: [staff('a')] }).svc.alert(target, 'initial')).toBe(1);
  });
  it('escalation goes to the focal person, not the responders who already missed it', async () => {
    const { svc, prisma } = make({ RESPONDER: [staff('s1')], DISTRICT_FOCAL: [staff('f')] });
    await svc.alert(target, 'escalation');
    expect(prisma.user.findMany.mock.calls[0][0].where.role.in).toEqual(['DISTRICT_FOCAL']);
  });
  it('audits and returns 0 when literally nobody can be alerted', async () => {
    const { svc, audit } = make({});
    expect(await svc.alert(target, 'initial')).toBe(0);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ALERT_NO_RECIPIENTS', outcome: 'FAILURE' }));
  });
});
