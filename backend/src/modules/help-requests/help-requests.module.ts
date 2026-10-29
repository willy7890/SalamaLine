import { Module } from '@nestjs/common';
import { HelpRequestsController } from './help-requests.controller';
import { HelpRequestsCoreModule } from './help-requests-core.module';

/** HTTP surface for help requests (public submit + staff case management). */
@Module({ imports: [HelpRequestsCoreModule], controllers: [HelpRequestsController] })
export class HelpRequestsModule {}
