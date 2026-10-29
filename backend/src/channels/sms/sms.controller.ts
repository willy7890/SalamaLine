import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { WebhookSecretGuard } from '../../common/guards/webhook-secret.guard';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { normalizePhone } from '../../common/utils/phone';
import { ConversationService } from '../conversation.service';
import { ReplyService } from '../reply.service';

/** Inbound SMS callback (Africa's Talking form fields: from, to, text, id, date, linkId). */
@ApiTags('channels')
@SkipThrottle()
@UseGuards(WebhookSecretGuard)
@Controller('webhooks/sms')
export class SmsController {
  constructor(
    private readonly conversation: ConversationService,
    private readonly replies: ReplyService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post()
  @HttpCode(200)
  async inbound(@Body() body: Record<string, unknown>) {
    const from = typeof body.from === 'string' ? normalizePhone(body.from) : null;
    const text = typeof body.text === 'string' ? body.text.slice(0, 500) : '';
    const messageId = typeof body.id === 'string' ? body.id : null;
    if (!from || !messageId) throw new BadRequestException();

    if (!(await this.idempotency.once('sms', messageId))) return { status: 'duplicate' };
    try {
      const replies = await this.conversation.handle('SMS', from, text);
      await this.replies.reply('SMS', from, replies);
    } catch (e) {
      await this.idempotency.forget('sms', messageId); // let the gateway's retry be processed
      throw e;
    }
    return { status: 'ok' };
  }
}
