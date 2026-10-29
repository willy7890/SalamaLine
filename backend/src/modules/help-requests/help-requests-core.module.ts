import { Module } from '@nestjs/common';
import { AlertService } from './alert.service';
import { EscalationService } from './escalation.service';
import { HelpRequestsService } from './help-requests.service';

/** Domain services only (no HTTP). Shared by the API, the channels and the worker process. */
@Module({
  providers: [HelpRequestsService, AlertService, EscalationService],
  exports: [HelpRequestsService, AlertService, EscalationService],
})
export class HelpRequestsCoreModule {}
