import { Global, Module } from '@nestjs/common';
import { DistrictsController } from './districts.controller';
import { DistrictsService } from './districts.service';

@Global()
@Module({ controllers: [DistrictsController], providers: [DistrictsService], exports: [DistrictsService] })
export class DistrictsModule {}
