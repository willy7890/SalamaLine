import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ENV, Env } from '../../config/config.module';
import { safeEqual } from '../utils/text';

/**
 * Authenticates SMS/USSD gateway callbacks with a shared secret (header `x-webhook-secret` or `?token=`)
 * and, optionally, a source-IP allowlist. Africa's Talking does not sign these callbacks, so the secret in the
 * callback URL plus the IP allowlist is the mechanism; confirm the gateway's current IP list with the provider.
 */
@Injectable()
export class WebhookSecretGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const secret = this.env.WEBHOOK_SHARED_SECRET;
    if (!secret) {
      if (this.env.NODE_ENV === 'production') throw new UnauthorizedException();
    } else {
      const supplied = (req.headers['x-webhook-secret'] as string | undefined) ?? (req.query?.token as string | undefined) ?? '';
      if (typeof supplied !== 'string' || !safeEqual(supplied, secret)) throw new UnauthorizedException();
    }
    const allow = this.env.WEBHOOK_IP_ALLOWLIST;
    if (allow.length > 0) {
      const ip = String(req.ip ?? '').replace(/^::ffff:/, '');
      if (!allow.includes(ip)) throw new UnauthorizedException();
    }
    return true;
  }
}
