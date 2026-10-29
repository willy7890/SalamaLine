import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateUserAccessDto {
  @ApiProperty() @IsBoolean() isActive: boolean;
  @ApiPropertyOptional({ enum: UserRole }) @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiPropertyOptional({ description: 'District code; empty string clears it.' })
  @IsOptional() @IsString() @MaxLength(40) districtCode?: string;
  @ApiPropertyOptional({ example: '+255712345678', description: 'Staff phone for alerts and ACK/CLOSE replies; empty string clears it.' })
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
}

export class CreateDistrictDto {
  @ApiProperty({ example: 'MBEYA_CITY' }) @IsString() @Matches(/^[A-Z0-9_]{2,40}$/) code: string;
  @ApiProperty() @IsString() @MaxLength(80) nameSw: string;
  @ApiProperty() @IsString() @MaxLength(80) nameEn: string;
  @ApiProperty({ example: 'Mbeya' }) @IsString() @MaxLength(80) region: string;
}
