import { Injectable } from '@nestjs/common';
import { Lang } from '../types/intent';
import { messages } from './messages';

@Injectable()
export class I18nService {
  t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
    const template = messages[lang][key] ?? messages.sw[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_m, name: string) => String(vars[name] ?? ''));
  }
}
