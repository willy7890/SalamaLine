import { Injectable } from '@nestjs/common';
import { PhoneHashService } from '../../common/crypto/phone-hash.service';
import { I18nService } from '../../common/i18n/i18n.service';
import { MetricsService } from '../../modules/dashboard/metrics.service';
import { DirectoryService } from '../../modules/directory/directory.service';
import { DistrictsService } from '../../modules/districts/districts.service';
import { HelpRequestsService } from '../../modules/help-requests/help-requests.service';
import { InfoService } from '../../modules/info/info.service';
import { PrivacyService } from '../../modules/privacy/privacy.service';
import { WellbeingService } from '../../modules/wellbeing/wellbeing.service';
import { Lang } from '../../common/types/intent';
import { ReplyService } from '../reply.service';
import { UssdPorts } from './menus/types';
import { render } from './ussd.renderer';
import { UssdEngine } from './ussd.engine';

export interface UssdRequest {
  sessionId: string;
  /** Normalised E.164 caller. Used only to act on THIS request (e.g. consented callback); never stored in a session. */
  phone: string;
  text: string;
}

@Injectable()
export class UssdService {
  constructor(
    private readonly i18n: I18nService,
    private readonly districts: DistrictsService,
    private readonly directory: DirectoryService,
    private readonly info: InfoService,
    private readonly requests: HelpRequestsService,
    private readonly privacy: PrivacyService,
    private readonly wellbeing: WellbeingService,
    private readonly metrics: MetricsService,
    private readonly replies: ReplyService,
    private readonly hashes: PhoneHashService,
  ) {}

  async handle(req: UssdRequest): Promise<string> {
    const inputs = req.text === '' ? [] : req.text.split('*');
    const engine = new UssdEngine(this.ports(req));
    return render(await engine.run(inputs));
  }

  private ports(req: UssdRequest): UssdPorts {
    // Provider retries of the same session never create a second case.
    const key = (purpose: string) => `ussd:${this.hashes.hashScoped('ussd-session', req.sessionId)}:${purpose}`;
    return {
      t: (lang, k, vars) => this.i18n.t(lang, k, vars),
      listDistricts: async (lang: Lang) => (await this.districts.list()).map((d) => ({ code: d.code, name: lang === 'sw' ? d.nameSw : d.nameEn })),
      infoFor: (topic, lang) => this.info.getForTopic(topic, lang),
      services: (districtCode, lang, types) => this.directory.formatForSms(districtCode, lang, types, 4),
      createHelp: async (a) =>
        (await this.requests.create({
          kind: 'SELF_HELP', topic: a.topic, districtCode: a.districtCode, channel: 'USSD', language: a.lang,
          priority: a.urgent ? 'URGENT' : 'NORMAL', contact: req.phone, consent: true, idempotencyKey: key('help'),
        })).caseCode,
      createReport: async (a) =>
        (await this.requests.create({
          kind: 'THIRD_PARTY_REPORT', topic: a.topic, districtCode: a.districtCode, channel: 'USSD', language: a.lang,
          consent: false, idempotencyKey: key('report'),
        })).caseCode,
      sendSms: (text) => this.replies.reply('SMS', req.phone, [text]),
      deleteMyData: async () => void (await this.privacy.deleteByPhone(req.phone)),
      wellbeing: (level) => this.wellbeing.record(level, 'USSD'),
      wellbeingTip: (lang) => this.wellbeing.tipText(lang),
      helplineText: (lang) => this.wellbeing.helplineText(lang, 'wellbeing_low'),
      metric: (k, districtCode) => this.metrics.increment(k, { channel: 'USSD', districtCode }),
    };
  }
}
