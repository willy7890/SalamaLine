import { UssdResult } from './menus/types';

export const USSD_MAX_CHARS = 182;

/** Formats the provider response: "CON <text>" keeps the session open, "END <text>" closes it. */
export function render(result: UssdResult): string {
  const prefix = `${result.type} `;
  const max = USSD_MAX_CHARS - prefix.length;
  const text = result.text.length > max ? `${result.text.slice(0, max - 1)}…` : result.text;
  return prefix + text;
}
