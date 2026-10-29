import { Module } from '@nestjs/common';
import { HelpRequestsCoreModule } from '../help-requests/help-requests-core.module';
import { RespondersService } from './responders.service';

@Module({ imports: [HelpRequestsCoreModule], providers: [RespondersService], exports: [RespondersService] })
export class RespondersModule {}
