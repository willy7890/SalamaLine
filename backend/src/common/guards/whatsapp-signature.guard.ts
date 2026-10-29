import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { ENV, Env } from '../../config/config.module';
import { safeEqual } from '../utils/text';

/** Verifies Meta's `X-Hub-Signature-256` (HMAC-SHA256 of the RAW body with the app secret). */
@Injectable()
export class WhatsAppSignatureGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const appSecret = this.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      if (this.env.NODE_ENV === 'production') throw new UnauthorizedException();
      return true; // development with WHATSAPP_PROVIDER=fake/disabled
    }
    const raw: Buffer | undefined = req.rawBody;
    const header = req.headers['x-hub-signature-256'];
    if (!raw || typeof header !== 'string') throw new UnauthorizedException();
    const expected = `sha256=${createHmac('sha256', appSecret).update(raw).digest('hex')}`;
    if (!safeEqual(header, expected)) throw new UnauthorizedException();
    return true;
  }
}
