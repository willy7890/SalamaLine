import { Module } from '@nestjs/common';
import { DirectoryModule } from '../modules/directory/directory.module';
import { HelpRequestsCoreModule } from '../modules/help-requests/help-requests-core.module';
import { InfoModule } from '../modules/info/info.module';
import { RespondersModule } from '../modules/responders/responders.module';
import { WellbeingModule } from '../modules/wellbeing/wellbeing.module';
import { ConversationService } from './conversation.service';
import { ReplyService } from './reply.service';
import { SmsController } from './sms/sms.controller';
import { UssdController } from './ussd/ussd.controller';
import { UssdService } from './ussd/ussd.service';
import { WhatsAppController } from './whatsapp/whatsapp.controller';

@Module({
  imports: [DirectoryModule, HelpRequestsCoreModule, InfoModule, RespondersModule, WellbeingModule],
  controllers: [UssdController, SmsController, WhatsAppController],
  providers: [ConversationService, ReplyService, UssdService],
})
export class ChannelsModule {}
