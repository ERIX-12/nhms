import { IsString, IsOptional, IsInt, Min, Max, IsEnum, IsBoolean, IsArray, IsDecimal } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType, RoomStatus } from '@prisma/client';

export class UpdateRoomDto {
  @ApiPropertyOptional({
    description: 'Room number',
    example: '102',
  })
  @IsOptional()
  @IsString()
  roomNumber?: string;

  @ApiPropertyOptional({
    description: 'Floor number',
    example: 2,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  floor?: number;

  @ApiPropertyOptional({
    description: 'Room type',
    enum: ['STANDARD', 'DELUXE', 'FAMILY_SUITE', 'BUSINESS_SUITE'],
    example: 'DELUXE',
  })
  @IsOptional()
  @IsEnum(RoomType)
  roomType?: RoomType;

  @ApiPropertyOptional({
    description: 'Room style description',
    example: 'King Bed with City View',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  roomStyle?: string;

  @ApiPropertyOptional({
    description: 'Booking price per night',
    example: 175.00,
    minimum: 0,
  })
  @IsOptional()
  @IsDecimal()
  @Min(0)
  bookingPrice?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of adults',
    example: 4,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxAdults?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of children',
    example: 2,
    minimum: 0,
    maximum: 6,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  maxChildren?: number;

  @ApiPropertyOptional({
    description: 'Smoking allowed',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  smokingAllowed?: boolean;

  @ApiPropertyOptional({
    description: 'Room amenities',
    example: ['TV', 'Mini Bar', 'Safe', 'WiFi', 'Air Conditioning'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  amenities?: string[];

  @ApiPropertyOptional({
    description: 'Room images URLs',
    example: ['https://example.com/room1.jpg', 'https://example.com/room2.jpg'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  images?: string[];

  @ApiPropertyOptional({
    description: 'Room key or access code',
    example: 'KEY102',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  roomKey?: string;

  @ApiPropertyOptional({
    description: 'Room status',
    enum: ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'UNDER_MAINTENANCE', 'CLEANING', 'OUT_OF_SERVICE'],
    example: 'AVAILABLE',
  })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;
}
