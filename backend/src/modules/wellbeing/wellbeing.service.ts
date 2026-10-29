import { Inject, Injectable } from '@nestjs/common';
import { Channel } from '@prisma/client';
import { I18nService } from '../../common/i18n/i18n.service';
import { Lang } from '../../common/types/intent';
import { ENV, Env } from '../../config/config.module';
import { MetricsService } from '../dashboard/metrics.service';
import { InfoService } from '../info/info.service';

export type WellbeingLevel = 'good' | 'ok' | 'low';

/**
 * Gentle, non-diagnostic check-in. Nothing the person answers is stored or scored: only an anonymous daily count.
 * A low answer shows the helpline FIRST, then offers a trained counsellor (only if she agrees).
 */
@Injectable()
export class WellbeingService {
  constructor(
    private readonly metrics: MetricsService,
    private readonly info: InfoService,
    private readonly i18n: I18nService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  static levelFromChoice(choice: string): WellbeingLevel | null {
    return ({ '1': 'good', '2': 'ok', '3': 'low' } as Record<string, WellbeingLevel>)[choice] ?? null;
  }

  async record(level: WellbeingLevel, channel: Channel) {
    await this.metrics.increment(`wellbeing_${level}`, { channel });
  }

  async tipText(lang: Lang): Promise<string> {
    const approved = await this.info.getForTopic('WELLBEING', lang);
    return approved?.shortText ?? this.i18n.t(lang, 'wellbeing_tip');
  }

  helplineText(lang: Lang, key: 'wellbeing_low' | 'sms_wellbeing_low'): string {
    return this.i18n.t(lang, key, { helpline: this.env.HELPLINE_NUMBER ?? '-' });
  }
}
