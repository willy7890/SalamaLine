import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReferralDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  serviceEntryId?: string;

  @ApiPropertyOptional({ description: 'The girl agreed to be referred to this service.' })
  @IsOptional()
  @IsBoolean()
  consentGranted?: boolean;
}
