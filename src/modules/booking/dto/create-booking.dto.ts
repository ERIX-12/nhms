import { IsString, IsOptional, IsDateString, IsInt, Min, Max, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingSource } from '@prisma/client';

export class CreateBookingDto {
  @ApiPropertyOptional({
    description: 'Guest ID (for existing guests)',
    example: 'guest_id_here',
  })
  @IsOptional()
  @IsString()
  guestId?: string;

  @ApiProperty({
    description: 'Room ID',
    example: 'room_id_here',
  })
  @IsString()
  roomId: string;

  @ApiProperty({
    description: 'Check-in date and time',
    example: '2024-01-15T14:00:00Z',
  })
  @IsDateString()
  checkInDate: string;

  @ApiProperty({
    description: 'Check-out date and time',
    example: '2024-01-17T11:00:00Z',
  })
  @IsDateString()
  checkOutDate: string;

  @ApiProperty({
    description: 'Number of adults',
    example: 2,
    minimum: 1,
    maximum: 10,
  })
  @IsInt()
  @Min(1)
  @Max(10)
  adultsCount: number;

  @ApiPropertyOptional({
    description: 'Number of children',
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  childrenCount?: number;

  @ApiPropertyOptional({
    description: 'Special requests or notes',
    example: 'Late check-in requested, ground floor room preferred',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;

  @ApiPropertyOptional({
    description: 'Booking source',
    enum: ['DIRECT', 'WEBSITE', 'PHONE', 'EMAIL', 'TRAVEL_AGENT', 'ONLINE_AGENCY'],
    example: 'DIRECT',
  })
  @IsOptional()
  @IsEnum(BookingSource)
  bookingSource?: BookingSource;

  @ApiPropertyOptional({
    description: 'Additional services requested',
    type: [AddOnServiceDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddOnServiceDto)
  addOnServices?: AddOnServiceDto[];
}

export class AddOnServiceDto {
  @ApiProperty({
    description: 'Service ID',
    example: 'airport_transfer',
  })
  @IsString()
  serviceId: string;

  @ApiProperty({
    description: 'Quantity',
    example: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Service-specific details',
    example: 'Flight details for airport transfer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}
