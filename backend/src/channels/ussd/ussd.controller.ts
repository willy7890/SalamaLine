import { BadRequestException, Body, Controller, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { WebhookSecretGuard } from '../../common/guards/webhook-secret.guard';
import { normalizePhone } from '../../common/utils/phone';
import { UssdService } from './ussd.service';

/** Africa's Talking USSD callback (form fields: sessionId, serviceCode, phoneNumber, networkCode, text). */
@ApiTags('channels')
@SkipThrottle()
@UseGuards(WebhookSecretGuard)
@Controller('webhooks/ussd')
export class UssdController {
  constructor(private readonly ussd: UssdService) {}

  @Post()
  @HttpCode(200)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async callback(@Body() body: Record<string, unknown>): Promise<string> {
    const phone = typeof body.phoneNumber === 'string' ? normalizePhone(body.phoneNumber) : null;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
    const text = typeof body.text === 'string' ? body.text.slice(0, 200) : '';
    if (!phone || !sessionId) throw new BadRequestException();
    return this.ussd.handle({ sessionId, phone, text });
  }
}
