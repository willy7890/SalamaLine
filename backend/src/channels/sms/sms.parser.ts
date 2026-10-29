import { Topic } from '@prisma/client';
import { Intent, Lang } from '../../common/types/intent';

export interface ParsedMessage {
  intent: Intent;
  lang: Lang;
}

const TOPIC_WORDS: Record<string, Topic> = {
  NDOA: 'CHILD_MARRIAGE', MARRIAGE: 'CHILD_MARRIAGE', FGM: 'FGM', UKEKETAJI: 'FGM',
  UKATILI: 'GBV', VIOLENCE: 'GBV', MTANDAONI: 'ONLINE_ABUSE', ONLINE: 'ONLINE_ABUSE',
  AFYA: 'HEALTH', HEALTH: 'HEALTH',
};

const SW_COMMANDS = new Set(['SALAMA', 'KLINIKI', 'MSAADA', 'RIPOTI', 'USTAWI', 'FUTA', 'NDIO', 'HAPANA', 'TAARIFA']);

/**
 * Parses an SMS/WhatsApp text. Commands: SALAMA, KLINIKI <wilaya>, MSAADA <wilaya> [mada], FGM <wilaya>,
 * RIPOTI <wilaya> [mada], USTAWI, FUTA (+ English aliases). Staff: ACK <code>, CLOSE <code>.
 */
export function parseMessage(raw: string): ParsedMessage {
  const text = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!text) return { intent: { type: 'UNKNOWN' }, lang: 'sw' };
  const [first, ...rest] = text.split(' ');
  const cmd = first.toUpperCase();
  const lang: Lang = SW_COMMANDS.has(cmd) ? 'sw' : 'en';

  // Optional trailing topic keyword: "MSAADA MBEYA CITY NDOA" -> district "MBEYA CITY", topic CHILD_MARRIAGE
  const split = (tokens: string[]): { district?: string; topic?: Topic } => {
    const copy = [...tokens];
    let topic: Topic | undefined;
    const last = copy[copy.length - 1]?.toUpperCase();
    if (last && TOPIC_WORDS[last] && copy.length > 1) {
      topic = TOPIC_WORDS[last];
      copy.pop();
    }
    return { district: copy.join(' ') || undefined, topic };
  };

  switch (cmd) {
    case 'SALAMA': case 'MENU': return { intent: { type: 'MENU' }, lang };
    case 'KLINIKI': case 'CLINIC': return { intent: { type: 'FIND_SERVICES', district: rest.join(' ') || undefined }, lang };
    case 'MSAADA': case 'HELP': {
      const { district, topic } = split(rest);
      return { intent: { type: 'REQUEST_HELP', district, topic: topic ?? 'OTHER' }, lang };
    }
    case 'FGM':
      return { intent: { type: 'REQUEST_HELP', district: rest.join(' ') || undefined, topic: 'FGM', urgent: true }, lang: 'sw' };
    case 'RIPOTI': case 'REPORT': {
      const { district, topic } = split(rest);
      return { intent: { type: 'REPORT_CONCERN', district, topic: topic ?? 'OTHER' }, lang };
    }
    case 'TAARIFA': case 'INFO': {
      const topic = TOPIC_WORDS[(rest[0] ?? '').toUpperCase()];
      return { intent: topic ? { type: 'INFO', topic } : { type: 'MENU' }, lang };
    }
    case 'USTAWI': case 'WELLBEING': return { intent: { type: 'WELLBEING' }, lang };
    case 'FUTA': case 'DELETE': return { intent: { type: 'DELETE_MY_DATA' }, lang };
    case 'NDIO': case 'YES': return { intent: { type: 'CONSENT_REPLY', granted: true }, lang };
    case 'HAPANA': case 'NO': return { intent: { type: 'CONSENT_REPLY', granted: false }, lang };
    case 'ACK': return rest[0] ? { intent: { type: 'STAFF_ACK', caseCode: rest[0].toUpperCase() }, lang: 'en' } : { intent: { type: 'UNKNOWN' }, lang };
    case 'CLOSE': return rest[0] ? { intent: { type: 'STAFF_CLOSE', caseCode: rest[0].toUpperCase() }, lang: 'en' } : { intent: { type: 'UNKNOWN' }, lang };
    default:
      if (/^[1-3]$/.test(text)) return { intent: { type: 'CHOICE', value: text }, lang: 'sw' };
      return { intent: { type: 'UNKNOWN' }, lang: 'sw' };
  }
}
