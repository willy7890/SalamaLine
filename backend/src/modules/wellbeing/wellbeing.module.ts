import { Module } from '@nestjs/common';
import { InfoModule } from '../info/info.module';
import { WellbeingService } from './wellbeing.service';

@Module({ imports: [InfoModule], providers: [WellbeingService], exports: [WellbeingService] })
export class WellbeingModule {}
