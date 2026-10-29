import { Channel, Topic } from '@prisma/client';

/** Normalised meaning of an inbound message, independent of the channel it arrived on. */
export type Intent =
  | { type: 'MENU' }
  | { type: 'FIND_SERVICES'; district?: string }
  | { type: 'REQUEST_HELP'; district?: string; topic: Topic; urgent?: boolean }
  | { type: 'REPORT_CONCERN'; district?: string; topic: Topic }
  | { type: 'INFO'; topic: Topic }
  | { type: 'WELLBEING' }
  | { type: 'DELETE_MY_DATA' }
  | { type: 'CONSENT_REPLY'; granted: boolean }
  | { type: 'STAFF_ACK'; caseCode: string }
  | { type: 'STAFF_CLOSE'; caseCode: string }
  | { type: 'CHOICE'; value: string }
  | { type: 'UNKNOWN' };

export type InboundChannel = Extract<Channel, 'SMS' | 'WHATSAPP' | 'USSD'>;
export type Lang = 'sw' | 'en';
