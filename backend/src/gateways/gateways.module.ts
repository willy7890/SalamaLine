import { Global, Module } from '@nestjs/common';
import { ENV, Env } from '../config/config.module';
import { AfricasTalkingGateway } from './africastalking.gateway';
import { FakeGateway } from './fake.gateway';
import { MESSAGE_GATEWAYS, MessageGateway } from './message-gateway';
import { WhatsAppCloudGateway } from './whatsapp-cloud.gateway';

/** Selects gateways from env. A channel with provider `disabled` simply has no gateway (sends fail loudly). */
@Global()
@Module({
  providers: [
    {
      provide: MESSAGE_GATEWAYS,
      inject: [ENV],
      useFactory: (env: Env): MessageGateway[] => {
        const gateways: MessageGateway[] = [];
        if (env.SMS_PROVIDER === 'africastalking') {
          gateways.push(new AfricasTalkingGateway({ username: env.AT_USERNAME!, apiKey: env.AT_API_KEY!, baseUrl: env.AT_BASE_URL, senderId: env.AT_SENDER_ID }));
        } else if (env.SMS_PROVIDER === 'fake') gateways.push(new FakeGateway('SMS'));
        if (env.WHATSAPP_PROVIDER === 'cloud') {
          gateways.push(new WhatsAppCloudGateway({ phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID!, accessToken: env.WHATSAPP_ACCESS_TOKEN! }));
        } else if (env.WHATSAPP_PROVIDER === 'fake') gateways.push(new FakeGateway('WHATSAPP'));
        return gateways;
      },
    },
  ],
  exports: [MESSAGE_GATEWAYS],
})
export class GatewaysModule {}
