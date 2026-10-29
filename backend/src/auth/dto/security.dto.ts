import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ConfirmMfaDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/)
  code: string;
}

export class ChangePasswordDto {
  @ApiProperty({ writeOnly: true }) @IsString() @MinLength(1) @MaxLength(128) currentPassword: string;
  @ApiProperty({ writeOnly: true, minLength: 12 }) @IsString() @MinLength(12) @MaxLength(128) newPassword: string;
}
