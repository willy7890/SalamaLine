import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ writeOnly: true, minLength: 1, maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ example: '123456', description: '6-digit authenticator code (required once 2FA is enabled).' })
  @IsOptional()
  @Matches(/^\d{6}$/)
  totpCode?: string;
}
