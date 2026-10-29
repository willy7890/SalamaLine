import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDate, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateServiceEntryDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) name: string;
  @ApiProperty({ enum: ServiceType }) @IsEnum(ServiceType) type: ServiceType;
  @ApiProperty({ example: 'MBEYA_CITY' }) @IsString() @MaxLength(40) district: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phonePublic?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(240) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) openingHours?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) languages?: string[];
  @ApiProperty({ description: 'Named partner organisation that verified this service' }) @IsString() @MinLength(2) @MaxLength(160) verificationOrg: string;
  @ApiProperty({ description: 'Person at the partner who confirmed it' }) @IsString() @MinLength(2) @MaxLength(120) verifiedBy: string;
  @ApiProperty() @Type(() => Date) @IsDate() verifiedAt: Date;
  @ApiPropertyOptional({ description: 'Defaults to 12 months after verification.' }) @IsOptional() @Type(() => Date) @IsDate() expiresAt?: Date;
}
