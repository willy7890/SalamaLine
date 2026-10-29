import { ApiProperty } from '@nestjs/swagger';
import { HelpRequestStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export const STAFF_SETTABLE_STATUSES = [
  HelpRequestStatus.IN_PROGRESS,
  HelpRequestStatus.REFERRED,
  HelpRequestStatus.CLOSED,
  HelpRequestStatus.CANCELLED,
] as const;

export class UpdateHelpRequestStatusDto {
  @ApiProperty({ enum: STAFF_SETTABLE_STATUSES })
  @IsIn(STAFF_SETTABLE_STATUSES)
  status: (typeof STAFF_SETTABLE_STATUSES)[number];
}
