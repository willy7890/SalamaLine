/**
 * A tiny in-memory stand-in for PrismaService, ONLY for `npm run demo` (preview without PostgreSQL).
 * It implements just the queries this app uses. It is not a substitute for the real database.
 */
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const UNIQUE: Record<string, string[][]> = {
  processedWebhook: [['provider', 'externalId']],
  helpRequest: [['caseCode'], ['idempotencyKey']],
  user: [['email'], ['phoneHash']],
  district: [['code']],
};

const DEFAULTS: Record<string, () => Row> = {
  user: () => ({ role: 'RESPONDER', isActive: false, districtCode: null, phoneEnc: null, phoneHash: null, totpSecretEnc: null, totpEnabledAt: null }),
  helpRequest: () => ({ kind: 'SELF_HELP', status: 'PENDING', priority: 'NORMAL', language: 'sw', consentToContact: false, contactEnc: null, contactHash: null, contactWipedAt: null, idempotencyKey: null, assignedResponderId: null, acceptedAt: null, closedAt: null, lastAlertAt: null, escalationCount: 0, escalatedAt: null }),
  notification: () => ({ status: 'QUEUED', attempts: 0, nextAttemptAt: new Date(), lastError: null, sentAt: null, recipientEnc: null, recipientHash: null, helpRequestId: null }),
  content: () => ({ status: 'DRAFT', language: 'sw', authorId: null, reviewerId: null, reviewedAt: null, reviewDueAt: null, publishedAt: null }),
  serviceDirectoryEntry: () => ({ isActive: false, languages: [] }),
  anonymousMetric: () => ({ count: 0, districtCode: 'ALL' }),
};

function cmp(value: any, cond: any): boolean { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (cond !== null && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
    return Object.entries(cond).every(([op, v]: [string, any]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      switch (op) {
        case 'in': return (v as unknown[]).includes(value);
        case 'not': return v === null ? value !== null && value !== undefined : value !== v;
        case 'lt': return value != null && value < v;
        case 'lte': return value != null && value <= v;
        case 'gt': return value != null && value > v;
        case 'gte': return value != null && value >= v;
        default: return true;
      }
    });
  }
  return (value ?? null) === (cond ?? null);
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return (v as Row[]).some((w) => matches(row, w));
    if (k === 'AND') return (Array.isArray(v) ? v : [v]).every((w: Row) => matches(row, w));
    return cmp(row[k], v);
  });
}

function dup(): never {
  throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'demo' });
}

class Table {
  rows: Row[] = [];
  constructor(private readonly name: string, private readonly db: InMemoryPrisma) {}

  private checkUnique(data: Row, ignore?: Row) {
    for (const cols of UNIQUE[this.name] ?? []) {
      if (cols.some((c) => data[c] == null)) continue;
      if (this.rows.some((r) => r !== ignore && cols.every((c) => r[c] === data[c]))) dup();
    }
  }
  private flatten(where: Row): Row {
    const out: Row = {};
    for (const [k, v] of Object.entries(where)) {
      if (v && typeof v === 'object' && !(v instanceof Date) && k.includes('_')) Object.assign(out, v);
      else out[k] = v;
    }
    return out;
  }
  async create({ data }: { data: Row }) {
    const { consents, ...rest } = data;
    const row = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...(DEFAULTS[this.name]?.() ?? {}), ...rest };
    this.checkUnique(row);
    this.rows.push(row);
    if (consents?.create) for (const c of consents.create) await this.db.consentRecord.create({ data: { ...c, helpRequestId: row.id } });
    return { ...row };
  }
  async findUnique({ where }: { where: Row }) { return this.rows.find((r) => matches(r, this.flatten(where))) ?? null; }
  async findFirst({ where }: { where?: Row } = {}) { return this.rows.find((r) => matches(r, where)) ?? null; }
  async findMany({ where, take }: { where?: Row; take?: number } = {}) {
    const out = this.rows.filter((r) => matches(r, where));
    return typeof take === 'number' ? out.slice(0, take) : out;
  }
  async count({ where }: { where?: Row } = {}) { return this.rows.filter((r) => matches(r, where)).length; }
  private apply(row: Row, data: Row) {
    for (const [k, v] of Object.entries(data)) {
      row[k] = v && typeof v === 'object' && 'increment' in v ? (row[k] ?? 0) + v.increment : v;
    }
    row.updatedAt = new Date();
  }
  async update({ where, data }: { where: Row; data: Row }) {
    const row = await this.findUnique({ where });
    if (!row) throw new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: 'demo' });
    this.apply(row, data);
    return { ...row };
  }
  async updateMany({ where, data }: { where?: Row; data: Row }) {
    const hit = this.rows.filter((r) => matches(r, where));
    hit.forEach((r) => this.apply(r, data));
    return { count: hit.length };
  }
  async deleteMany({ where }: { where?: Row } = {}) {
    const keep = this.rows.filter((r) => !matches(r, where));
    const count = this.rows.length - keep.length;
    this.rows = keep;
    return { count };
  }
  async upsert({ where, create, update }: { where: Row; create: Row; update: Row }) {
    const row = await this.findUnique({ where });
    if (row) { this.apply(row, update); return { ...row }; }
    return this.create({ data: create });
  }
  async groupBy() { return []; }
}

export class InMemoryPrisma {
  district = new Table('district', this);
  user = new Table('user', this);
  content = new Table('content', this);
  serviceDirectoryEntry = new Table('serviceDirectoryEntry', this);
  helpRequest = new Table('helpRequest', this);
  consentRecord = new Table('consentRecord', this);
  referral = new Table('referral', this);
  notification = new Table('notification', this);
  processedWebhook = new Table('processedWebhook', this);
  auditEvent = new Table('auditEvent', this);
  anonymousMetric = new Table('anonymousMetric', this);
  async onModuleInit() {}
  async onModuleDestroy() {}
  async $queryRaw() { return [1]; }
  async $transaction(ops: Promise<unknown>[]) { return Promise.all(ops); }
}
