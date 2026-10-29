import { Body, Controller, ForbiddenException, Get, HttpCode, Inject, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { WhatsAppSignatureGuard } from '../../common/guards/whatsapp-signature.guard';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { normalizePhone } from '../../common/utils/phone';
import { safeEqual } from '../../common/utils/text';
import { ENV, Env } from '../../config/config.module';
import { ConversationService } from '../conversation.service';
import { ReplyService } from '../reply.service';

interface WaPayload {
  entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ id?: string; from?: string; type?: string; text?: { body?: string } }> } }> }>;
}

@ApiTags('channels')
@SkipThrottle()
@Controller('webhooks/whatsapp')
export class WhatsAppController {
  constructor(
    private readonly conversation: ConversationService,
    private readonly replies: ReplyService,
    private readonly idempotency: IdempotencyService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Meta's one-time webhook verification handshake. */
  @Get()
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string, @Res() res: Response) {
    const expected = this.env.WHATSAPP_VERIFY_TOKEN;
    if (mode !== 'subscribe' || !expected || typeof token !== 'string' || !safeEqual(token, expected)) throw new ForbiddenException();
    res.status(200).type('text/plain').send(String(challenge ?? ''));
  }

  @Post()
  @UseGuards(WhatsAppSignatureGuard)
  @HttpCode(200)
  async inbound(@Body() body: WaPayload) {
    const messages = (body.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((c) => c.value?.messages ?? []));
    for (const m of messages) {
      const from = m.from ? normalizePhone(`+${m.from}`) : null;
      if (!m.id || !from) continue;
      if (!(await this.idempotency.once('whatsapp', m.id))) continue;
      try {
        // Non-text messages (images, voice, ...) get the menu rather than silence.
        const text = m.type === 'text' ? (m.text?.body ?? '').slice(0, 500) : 'SALAMA';
        await this.replies.reply('WHATSAPP', from, await this.conversation.handle('WHATSAPP', from, text));
      } catch (e) {
        await this.idempotency.forget('whatsapp', m.id);
        throw e;
      }
    }
    return { status: 'ok' };
  }
}
