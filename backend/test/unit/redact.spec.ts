import { Writable } from 'node:stream';
import pino from 'pino';
import { buildPinoOptions } from '../../src/common/logging/redact.config';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({ write(chunk, _e, cb) { lines.push(chunk.toString()); cb(); } });
  return { lines, logger: pino(buildPinoOptions(false), stream) };
}

describe('log privacy', () => {
  it('redacts phone numbers, message text and credentials in structured fields', () => {
    const { lines, logger } = capture();
    logger.info({ phone: '+255712345678', text: 'I am afraid', req: { body: { x: 1 }, headers: { authorization: 'Bearer abc' } }, user: { sender: '+255700000000', password: 'hunter2' } }, 'event');
    const out = lines.join('');
    for (const secret of ['+255712345678', 'I am afraid', 'Bearer abc', '+255700000000', 'hunter2']) expect(out).not.toContain(secret);
    expect(out).toContain('[Redacted]');
  });
  it('scrubs phone-number-looking text inside log messages', () => {
    const { lines, logger } = capture();
    logger.info('failed to deliver to +255 712 345 678 just now');
    expect(lines.join('')).not.toContain('712 345 678');
    expect(lines.join('')).toContain('[number]');
  });
});
