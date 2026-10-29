import { Module } from '@nestjs/common';
import { HelpRequestsCoreModule } from '../modules/help-requests/help-requests-core.module';
import { EscalationProcessor } from './escalation.processor';
import { NotificationProcessor } from './notification.processor';
import { RetentionProcessor } from './retention.processor';
import { RetentionService } from './retention.service';

@Module({
  imports: [HelpRequestsCoreModule],
  providers: [EscalationProcessor, NotificationProcessor, RetentionProcessor, RetentionService],
  exports: [RetentionService],
})
export class JobsModule {}
