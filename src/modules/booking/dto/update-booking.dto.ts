import { IsString, IsOptional, IsDateString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingSource } from '@prisma/client';

export class UpdateBookingDto {
  @ApiPropertyOptional({
    description: 'Updated check-in date and time',
    example: '2024-01-15T14:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  checkInDate?: string;

  @ApiPropertyOptional({
    description: 'Updated check-out date and time',
    example: '2024-01-17T11:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  checkOutDate?: string;

  @ApiPropertyOptional({
    description: 'Updated number of adults',
    example: 3,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  adultsCount?: number;

  @ApiPropertyOptional({
    description: 'Updated number of children',
    example: 2,
    minimum: 0,
    maximum: 6,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  childrenCount?: number;

  @ApiPropertyOptional({
    description: 'Updated special requests or notes',
    example: 'Updated special requests',
  })
  @IsOptional()
  @IsString()
  specialRequests?: string;

  @ApiPropertyOptional({
    description: 'Updated booking source',
    enum: ['DIRECT', 'WEBSITE', 'PHONE', 'EMAIL', 'TRAVEL_AGENT', 'ONLINE_AGENCY'],
    example: 'WEBSITE',
  })
  @IsOptional()
  @IsEnum(BookingSource)
  bookingSource?: BookingSource;
}
