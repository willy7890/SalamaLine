import { Inject, Injectable } from '@nestjs/common';
import { PhoneHashService } from '../common/crypto/phone-hash.service';
import { I18nService } from '../common/i18n/i18n.service';
import { InboundChannel, Intent, Lang } from '../common/types/intent';
import { ENV, Env } from '../config/config.module';
import { KV_STORE, KvStore } from '../infrastructure/redis/kv-store';
import { MetricsService } from '../modules/dashboard/metrics.service';
import { DirectoryService } from '../modules/directory/directory.service';
import { DistrictsService } from '../modules/districts/districts.service';
import { HelpRequestsService } from '../modules/help-requests/help-requests.service';
import { InfoService } from '../modules/info/info.service';
import { consentKey, PrivacyService } from '../modules/privacy/privacy.service';
import { RespondersService } from '../modules/responders/responders.service';
import { WellbeingLevel, WellbeingService } from '../modules/wellbeing/wellbeing.service';
import { parseMessage } from './sms/sms.parser';

const PENDING_TTL_SECONDS = 15 * 60;
const MAX_MESSAGES_PER_HOUR = 30;

interface Pending {
  kind: 'help' | 'wellbeing';
  lang: Lang;
  districtCode?: string;
  topic?: 'CHILD_MARRIAGE' | 'FGM' | 'GBV' | 'ONLINE_ABUSE' | 'HEALTH' | 'WELLBEING' | 'OTHER';
  urgent?: boolean;
}

/** Turns an inbound SMS/WhatsApp text into reply text. Channel-agnostic: the controllers do the I/O. */
@Injectable()
export class ConversationService {
  constructor(
    private readonly hashes: PhoneHashService,
    private readonly i18n: I18nService,
    private readonly districts: DistrictsService,
    private readonly directory: DirectoryService,
    private readonly info: InfoService,
    private readonly requests: HelpRequestsService,
    private readonly privacy: PrivacyService,
    private readonly responders: RespondersService,
    private readonly wellbeing: WellbeingService,
    private readonly metrics: MetricsService,
    @Inject(KV_STORE) private readonly kv: KvStore,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private helplineSuffix(lang: Lang) {
    return this.env.HELPLINE_NUMBER ? (lang === 'sw' ? ` Msaada wa haraka: ${this.env.HELPLINE_NUMBER}` : ` Urgent help: ${this.env.HELPLINE_NUMBER}`) : '';
  }

  async handle(channel: InboundChannel, sender: string, text: string): Promise<string[]> {
    const hash = this.hashes.hash(sender);
    const { intent, lang: parsedLang } = parseMessage(text);
    let lang = parsedLang;

    if ((await this.kv.incr(`rl:${hash}`, 3600)) > MAX_MESSAGES_PER_HOUR) return [this.i18n.t(lang, 'rate_limited')];

    const pending = await this.loadPending(hash);
    if (pending && (intent.type === 'CONSENT_REPLY' || intent.type === 'CHOICE')) lang = pending.lang;
    const t = (key: string, vars?: Record<string, string | number>) => this.i18n.t(lang, key, vars);

    switch (intent.type) {
      case 'MENU':
        return [t('sms_menu', { helpline: this.helplineSuffix(lang) })];
      case 'FIND_SERVICES':
        return this.findServices(channel, intent.district, lang);
      case 'INFO':
        return this.infoReply(channel, intent.topic, lang);
      case 'REQUEST_HELP':
        return this.askConsent(hash, intent, lang);
      case 'REPORT_CONCERN':
        return this.report(channel, intent, lang);
      case 'WELLBEING':
        await this.kv.set(consentKey(hash), JSON.stringify({ kind: 'wellbeing', lang } satisfies Pending), PENDING_TTL_SECONDS);
        return [t('wellbeing_q')];
      case 'CHOICE':
        return this.wellbeingChoice(channel, hash, intent.value, pending, lang);
      case 'CONSENT_REPLY':
        return this.consentReply(channel, sender, hash, intent.granted, pending, lang);
      case 'DELETE_MY_DATA':
        await this.privacy.deleteByPhone(sender);
        return [t('sms_deleted')];
      case 'STAFF_ACK':
      case 'STAFF_CLOSE':
        return this.staff(intent, sender);
      default:
        return [t('sms_unknown')];
    }
  }

  private async loadPending(hash: string): Promise<Pending | null> {
    const raw = await this.kv.get(consentKey(hash));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Pending;
    } catch {
      return null;
    }
  }

  private async findServices(channel: InboundChannel, districtText: string | undefined, lang: Lang) {
    const district = await this.districts.resolve(districtText);
    if (!district) return [this.i18n.t(lang, 'sms_district_unknown')];
    await this.metrics.increment('services_lookup', { channel, districtCode: district.code });
    const lines = await this.directory.formatForSms(district.code, lang);
    if (lines.length === 0) return [`SalamaLine: ${this.i18n.t(lang, 'services_none')}`];
    return [`SalamaLine: ${this.i18n.t(lang, 'services_header')}\n${lines.join('\n')}`];
  }

  private async infoReply(channel: InboundChannel, topic: Parameters<InfoService['getForTopic']>[0], lang: Lang) {
    await this.metrics.increment('info_request', { channel });
    const content = await this.info.getForTopic(topic, lang);
    if (!content) return [`SalamaLine: ${this.i18n.t(lang, 'no_content')}`];
    return [`${this.i18n.t(lang, 'sms_info_header')}${content.fullText}`];
  }

  private async askConsent(hash: string, intent: Extract<Intent, { type: 'REQUEST_HELP' }>, lang: Lang) {
    const district = await this.districts.resolve(intent.district);
    if (!district) return [this.i18n.t(lang, 'sms_district_unknown')];
    const pending: Pending = { kind: 'help', lang, districtCode: district.code, topic: intent.topic, urgent: intent.urgent };
    await this.kv.set(consentKey(hash), JSON.stringify(pending), PENDING_TTL_SECONDS);
    return [this.i18n.t(lang, 'sms_consent')];
  }

  private async report(channel: InboundChannel, intent: Extract<Intent, { type: 'REPORT_CONCERN' }>, lang: Lang) {
    const district = await this.districts.resolve(intent.district);
    if (!district) return [this.i18n.t(lang, 'sms_district_unknown')];
    // Anonymous by construction: the sender's number is never passed to the request.
    const created = await this.requests.create({ kind: 'THIRD_PARTY_REPORT', topic: intent.topic, districtCode: district.code, channel, language: lang, consent: false });
    return [this.i18n.t(lang, 'sms_report_neutral', { code: created.caseCode })];
  }

  private async consentReply(channel: InboundChannel, sender: string, hash: string, granted: boolean, pending: Pending | null, lang: Lang) {
    if (!pending || pending.kind !== 'help' || !pending.districtCode || !pending.topic) return [this.i18n.t(lang, 'sms_consent_expired')];
    await this.kv.del(consentKey(hash));
    if (!granted) {
      // Declining never blocks services: she still gets nearby verified services, and nobody is alerted.
      const lines = await this.directory.formatForSms(pending.districtCode, lang);
      return [this.i18n.t(lang, 'sms_declined'), ...(lines.length ? [`SalamaLine: ${this.i18n.t(lang, 'services_header')}\n${lines.join('\n')}`] : [])];
    }
    const created = await this.requests.create({
      kind: 'SELF_HELP', topic: pending.topic, districtCode: pending.districtCode, channel, language: lang,
      priority: pending.urgent ? 'URGENT' : 'NORMAL', contact: sender, consent: true,
    });
    return [this.i18n.t(lang, 'sms_ack_neutral', { code: created.caseCode })];
  }

  private async wellbeingChoice(channel: InboundChannel, hash: string, value: string, pending: Pending | null, lang: Lang) {
    if (!pending || pending.kind !== 'wellbeing') return [this.i18n.t(lang, 'sms_unknown')];
    await this.kv.del(consentKey(hash));
    const level = WellbeingService.levelFromChoice(value) as WellbeingLevel;
    await this.wellbeing.record(level, channel);
    if (level === 'low') return [this.wellbeing.helplineText(lang, 'sms_wellbeing_low')];
    return [`SalamaLine: ${await this.wellbeing.tipText(lang)}`];
  }

  private async staff(intent: Extract<Intent, { type: 'STAFF_ACK' | 'STAFF_CLOSE' }>, sender: string) {
    const user = await this.responders.identify(sender);
    // Unknown senders get the same reply as for any unrecognised text: staff accounts are not revealed.
    if (!user) return [this.i18n.t('sw', 'sms_unknown')];
    return [intent.type === 'STAFF_ACK' ? await this.responders.ack(user, intent.caseCode) : await this.responders.close(user, intent.caseCode)];
  }
}
