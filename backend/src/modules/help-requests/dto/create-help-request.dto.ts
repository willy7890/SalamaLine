import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HelpRequestPriority, Topic } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateHelpRequestDto {
  @ApiProperty({ enum: Topic })
  @IsEnum(Topic)
  topic: Topic;

  @ApiProperty({ example: 'MBEYA_CITY', description: 'District code or name' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  district: string;

  @ApiProperty({ description: 'Must be true for a responder to receive the number.' })
  @IsBoolean()
  consentToContact: boolean;

  @ApiPropertyOptional({ example: '+255712345678', description: 'Required only when consentToContact is true.' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contact?: string;

  @ApiPropertyOptional({ enum: HelpRequestPriority })
  @IsOptional()
  @IsEnum(HelpRequestPriority)
  priority?: HelpRequestPriority;
}

export class CreateReportDto {
  @ApiProperty({ enum: Topic })
  @IsEnum(Topic)
  topic: Topic;

  @ApiProperty({ example: 'KYELA' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  district: string;
}
