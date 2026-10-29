import { ServiceType, Topic } from '@prisma/client';
import { Lang } from '../../common/types/intent';
import { Purpose, ScreenId, UssdPorts, UssdResult, UssdState } from './menus/types';

const PAGE_SIZE = 6;
const TOPIC_BY_CHOICE: Record<string, Topic> = { '1': 'CHILD_MARRIAGE', '3': 'GBV', '4': 'ONLINE_ABUSE', '5': 'OTHER' };
const INFO_TOPIC_BY_CHOICE: Record<string, Topic> = { '1': 'CHILD_MARRIAGE', '2': 'FGM', '3': 'ONLINE_ABUSE', '4': 'HEALTH' };
const CARE_SERVICES: ServiceType[] = ['CLINIC', 'COUNSELLING'];

type Transition = { goto: ScreenId } | { end: string } | { stay: true } | { invalid: true };

/**
 * Stateless USSD state machine. Africa's Talking sends the whole path so far ("1*2*1"), so we REPLAY the inputs
 * from the start on every callback: no session storage, nothing about the person is kept between screens.
 * Side effects (creating a request, sending an SMS) only happen on transitions that END the session, so replay
 * never repeats them. `0` = back, `00` = exit, `99` = delete my data.
 */
export class UssdEngine {
  constructor(private readonly ports: UssdPorts) {}

  async run(inputs: string[]): Promise<UssdResult> {
    const state: UssdState = { lang: 'sw', screen: 'LANG', stack: [], urgent: false, page: 0 };
    for (const raw of inputs) {
      const input = raw.trim();
      state.invalid = false;
      if (input === '00') return { type: 'END', text: this.ports.t(state.lang, 'goodbye') };
      if (input === '0' && state.stack.length > 0) {
        state.screen = state.stack.pop()!;
        state.page = 0;
        continue;
      }
      if (input === '99' && state.screen !== 'LANG') {
        this.go(state, 'DELETE_CONFIRM');
        continue;
      }
      const tr = await this.onInput(state, input);
      if ('end' in tr) return { type: 'END', text: tr.end };
      if ('goto' in tr) this.go(state, tr.goto);
      else if ('invalid' in tr) state.invalid = true;
    }
    return { type: 'CON', text: await this.renderScreen(state) };
  }

  private go(state: UssdState, next: ScreenId) {
    state.stack.push(state.screen);
    state.screen = next;
    state.page = 0;
  }

  private footer(state: UssdState): string {
    return state.screen === 'LANG' || state.screen === 'MAIN' ? '' : `\n0 ${state.lang === 'sw' ? 'Rudi' : 'Back'}`;
  }

  // ───────────── rendering ─────────────

  private async renderScreen(state: UssdState): Promise<string> {
    const { t } = this.ports;
    const lang = state.lang;
    const err = state.invalid ? `${t(lang, 'invalid')}\n` : '';
    let body: string;
    switch (state.screen) {
      case 'LANG': body = t(lang, 'lang_prompt'); break;
      case 'MAIN': body = t(lang, 'menu_main'); break;
      case 'INFO_TOPIC': body = t(lang, 'info_topics'); break;
      case 'TOPIC': body = t(lang, 'pick_topic'); break;
      case 'FGM': body = t(lang, 'fgm_menu'); break;
      case 'CONSENT': body = t(lang, 'consent_prompt'); break;
      case 'WB': body = t(lang, 'wellbeing_q'); break;
      case 'WB_LOW': body = this.ports.helplineText(lang); break;
      case 'DELETE_CONFIRM': body = t(lang, 'delete_confirm'); break;
      case 'DISTRICT': body = await this.renderDistricts(state); break;
      case 'INFO_VIEW': body = await this.renderInfo(state); break;
      case 'SERVICES_VIEW': body = await this.renderServices(state); break;
    }
    // Footer is dropped first if the screen is too long: the content matters more than the hint.
    return `${err}${body}${this.footer(state)}`;
  }

  private async renderDistricts(state: UssdState): Promise<string> {
    const all = await this.ports.listDistricts(state.lang);
    if (all.length === 0) return this.ports.t(state.lang, 'no_districts');
    const slice = all.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
    const more = (state.page + 1) * PAGE_SIZE < all.length;
    const lines = slice.map((d, i) => `${i + 1} ${d.name}`);
    if (more) lines.push(`8 ${state.lang === 'sw' ? 'Zaidi' : 'More'}`);
    return `${this.ports.t(state.lang, 'pick_district')}\n${lines.join('\n')}`;
  }

  private async renderInfo(state: UssdState): Promise<string> {
    await this.ports.metric('info_request');
    const content = state.topic ? await this.ports.infoFor(state.topic, state.lang) : null;
    if (!content) return this.ports.t(state.lang, 'no_content');
    return `${content.shortText}\n${this.ports.t(state.lang, 'offer_sms').split('\n')[0]}`;
  }

  private async renderServices(state: UssdState): Promise<string> {
    if (!state.district) return this.ports.t(state.lang, 'services_none');
    await this.ports.metric('services_lookup', state.district);
    const lines = await this.ports.services(state.district, state.lang, state.serviceTypes);
    if (lines.length === 0) return this.ports.t(state.lang, 'services_none');
    return `${lines.slice(0, 3).join('\n')}\n${this.ports.t(state.lang, 'offer_sms').split('\n')[0]}`;
  }

  // ───────────── input handling ─────────────

  private async onInput(s: UssdState, input: string): Promise<Transition> {
    const { t } = this.ports;
    const bad: Transition = { invalid: true };
    switch (s.screen) {
      case 'LANG':
        if (input === '1' || input === '2') {
          s.lang = (input === '1' ? 'sw' : 'en') as Lang;
          return { goto: 'MAIN' };
        }
        return bad;

      case 'MAIN':
        switch (input) {
          case '1': return { goto: 'INFO_TOPIC' };
          case '2': return this.pickPurpose(s, 'SERVICES');
          case '3': return this.pickPurpose(s, 'HELP');
          case '4': return this.pickPurpose(s, 'REPORT');
          case '5': return { goto: 'WB' };
          default: return bad;
        }

      case 'INFO_TOPIC': {
        const topic = INFO_TOPIC_BY_CHOICE[input];
        if (!topic) return bad;
        s.topic = topic;
        return { goto: 'INFO_VIEW' };
      }

      case 'INFO_VIEW': {
        if (input !== '1' || !s.topic) return bad;
        const content = await this.ports.infoFor(s.topic, s.lang);
        if (!content) return bad;
        await this.ports.sendSms(`SalamaLine: ${content.fullText}`);
        return { end: t(s.lang, 'sms_queued') };
      }

      case 'DISTRICT': {
        const all = await this.ports.listDistricts(s.lang);
        if (input === '8' && (s.page + 1) * PAGE_SIZE < all.length) {
          s.page += 1;
          return { stay: true };
        }
        const idx = Number(input) - 1;
        const chosen = Number.isInteger(idx) && idx >= 0 && idx < PAGE_SIZE ? all[s.page * PAGE_SIZE + idx] : undefined;
        if (!chosen) return bad;
        s.district = chosen.code;
        if (s.purpose === 'SERVICES') return { goto: 'SERVICES_VIEW' };
        // A low wellbeing check-in already chose its topic (counselling request).
        if (s.purpose === 'HELP' && s.topic === 'WELLBEING') return { goto: 'CONSENT' };
        return { goto: 'TOPIC' };
      }

      case 'TOPIC': {
        if (input === '2') return { goto: 'FGM' };
        const topic = TOPIC_BY_CHOICE[input];
        if (!topic) return bad;
        s.topic = topic;
        s.urgent = false;
        return s.purpose === 'REPORT' ? this.finishReport(s) : { goto: 'CONSENT' };
      }

      case 'FGM':
        switch (input) {
          case '1': // "I am afraid I will be cut": urgent request, consent first
            s.topic = 'FGM'; s.urgent = true; s.purpose = 'HELP';
            return { goto: 'CONSENT' };
          case '2': // "I am worried about a girl": anonymous report
            s.topic = 'FGM'; s.urgent = false; s.purpose = 'REPORT';
            return this.finishReport(s);
          case '3': // "I was cut, I need care": services only, no alert raised
            s.serviceTypes = CARE_SERVICES; s.purpose = 'SERVICES';
            return { goto: 'SERVICES_VIEW' };
          case '4':
            s.topic = 'FGM';
            return { goto: 'INFO_VIEW' };
          default: return bad;
        }

      case 'CONSENT': {
        if (!s.topic || !s.district) return bad;
        if (input === '1') {
          const code = await this.ports.createHelp({ topic: s.topic, districtCode: s.district, urgent: s.urgent, lang: s.lang });
          return { end: t(s.lang, 'help_created', { code }) };
        }
        if (input === '2') {
          // Declining never blocks services: show nearby services, alert nobody.
          const lines = await this.ports.services(s.district, s.lang);
          const first = t(s.lang, 'help_declined');
          return { end: lines.length ? `${first}\n${lines.slice(0, 2).join('\n')}` : first };
        }
        return bad;
      }

      case 'SERVICES_VIEW': {
        if (input !== '1' || !s.district) return bad;
        const lines = await this.ports.services(s.district, s.lang, s.serviceTypes);
        if (!lines.length) return bad;
        await this.ports.sendSms(`SalamaLine: ${t(s.lang, 'services_header')}\n${lines.join('\n')}`);
        return { end: t(s.lang, 'sms_queued') };
      }

      case 'WB': {
        const level = ({ '1': 'good', '2': 'ok', '3': 'low' } as const)[input as '1' | '2' | '3'];
        if (!level) return bad;
        await this.ports.wellbeing(level);
        if (level === 'low') return { goto: 'WB_LOW' };
        return { end: await this.ports.wellbeingTip(s.lang) };
      }

      case 'WB_LOW':
        if (input === '1') {
          s.purpose = 'HELP'; s.topic = 'WELLBEING'; s.urgent = false;
          return { goto: 'DISTRICT' };
        }
        if (input === '2') return { end: t(s.lang, 'goodbye') };
        return bad;

      case 'DELETE_CONFIRM':
        if (input === '1') {
          await this.ports.deleteMyData();
          return { end: t(s.lang, 'deleted') };
        }
        if (input === '2') return { end: t(s.lang, 'goodbye') };
        return bad;
    }
  }

  private pickPurpose(s: UssdState, purpose: Purpose): Transition {
    s.purpose = purpose;
    s.topic = undefined;
    s.serviceTypes = undefined;
    s.urgent = false;
    return { goto: 'DISTRICT' };
  }

  private async finishReport(s: UssdState): Promise<Transition> {
    if (!s.topic || !s.district) return { invalid: true };
    const code = await this.ports.createReport({ topic: s.topic, districtCode: s.district, lang: s.lang });
    return { end: this.ports.t(s.lang, 'report_created', { code }) };
  }
}
