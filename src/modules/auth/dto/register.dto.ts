import { IsEmail, IsString, IsOptional, MaxLength, MinLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
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
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '+256712345678',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Hotel ID (for hotel staff)',
    example: 'hotel_id_here',
  })
  @IsOptional()
  @IsString()
  hotelId?: string;

  @ApiPropertyOptional({
    description: 'User role (for admin registration)',
    enum: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'HOUSEKEEPER', 'GUEST'],
  })
  @IsOptional()
  @IsEnum(['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'HOUSEKEEPER', 'GUEST'])
  role?: string;
}
