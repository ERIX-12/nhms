import { IsEmail, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@nyaikahotel.com',
  })
  @IsEmail()
  @IsString()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'Password123!',
  })
  @IsString()
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({
    description: 'Two-factor authentication code (if enabled)',
    example: '123456',
  })
  @IsOptional()
  @IsString()
  @MaxLength(6)
  twoFactorCode?: string;

  @ApiPropertyOptional({
    description: 'Remember me for extended session',
    example: false,
  })
  @IsOptional()
  rememberMe?: boolean;
}
