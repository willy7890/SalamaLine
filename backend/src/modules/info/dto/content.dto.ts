import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Topic } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateContentDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(100) slug: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(180) title: string;
  @ApiProperty({ enum: ['sw', 'en'] }) @IsIn(['sw', 'en']) language: string;
  @ApiProperty({ enum: Topic }) @IsEnum(Topic) topic: Topic;
  @ApiProperty({ description: 'Short version shown on a USSD screen (max 150 chars; one screen is ~182).' })
  @IsString() @MinLength(10) @MaxLength(150) shortText: string;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(12000) fullText: string;
  @ApiProperty({ description: 'Named source of the information' }) @IsString() @MinLength(2) @MaxLength(200) sourceName: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl() sourceUrl?: string;
}

export class ReviewContentDto {
  @ApiProperty() @IsBoolean() approve: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @ApiPropertyOptional({ description: 'Content stops being served after this date unless re-reviewed. Defaults to 12 months.' })
  @IsOptional() @Type(() => Date) @IsDate() reviewDueAt?: Date;
}
