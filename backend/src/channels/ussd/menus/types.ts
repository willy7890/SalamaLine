import { ServiceType, Topic } from '@prisma/client';
import { Lang } from '../../../common/types/intent';

export type ScreenId =
  | 'LANG' | 'MAIN' | 'INFO_TOPIC' | 'INFO_VIEW' | 'DISTRICT' | 'TOPIC' | 'FGM'
  | 'CONSENT' | 'SERVICES_VIEW' | 'WB' | 'WB_LOW' | 'DELETE_CONFIRM';

export type Purpose = 'SERVICES' | 'HELP' | 'REPORT';

export interface UssdState {
  lang: Lang;
  screen: ScreenId;
  stack: ScreenId[];
  purpose?: Purpose;
  district?: string;
  topic?: Topic;
  urgent: boolean;
  page: number;
  serviceTypes?: ServiceType[];
  /** Set when the last input was not valid for the screen. */
  invalid?: boolean;
}

export interface UssdResult {
  type: 'CON' | 'END';
  text: string;
}

/** Everything the engine needs from the outside world. Per-request: closes over caller and session. */
export interface UssdPorts {
  t(lang: Lang, key: string, vars?: Record<string, string | number>): string;
  listDistricts(lang: Lang): Promise<Array<{ code: string; name: string }>>;
  infoFor(topic: Topic, lang: Lang): Promise<{ shortText: string; fullText: string } | null>;
  services(districtCode: string, lang: Lang, types?: ServiceType[]): Promise<string[]>;
  createHelp(a: { topic: Topic; districtCode: string; urgent: boolean; lang: Lang }): Promise<string>;
  createReport(a: { topic: Topic; districtCode: string; lang: Lang }): Promise<string>;
  sendSms(text: string): Promise<void>;
  deleteMyData(): Promise<void>;
  wellbeing(level: 'good' | 'ok' | 'low'): Promise<void>;
  wellbeingTip(lang: Lang): Promise<string>;
  helplineText(lang: Lang): string;
  metric(key: string, districtCode?: string): Promise<void>;
}
