import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DistrictsService } from './districts.service';

@ApiTags('districts')
@Controller('districts')
export class DistrictsController {
  constructor(private readonly districts: DistrictsService) {}
  @Get()
  list() {
    return this.districts.list();
  }
}
