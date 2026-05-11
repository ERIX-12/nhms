import { IsString, IsOptional, IsInt, Min, Max, IsEnum, IsBoolean, IsArray, IsDecimal } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType } from '@prisma/client';

export class CreateRoomDto {
  @ApiProperty({
    description: 'Room number',
    example: '101',
  })
  @IsString()
  roomNumber: string;

  @ApiPropertyOptional({
    description: 'Floor number',
    example: 1,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  floor?: number;

  @ApiProperty({
    description: 'Room type',
    enum: ['STANDARD', 'DELUXE', 'FAMILY_SUITE', 'BUSINESS_SUITE'],
    example: 'DELUXE',
  })
  @IsEnum(RoomType)
  roomType: RoomType;

  @ApiProperty({
    description: 'Room style description',
    example: 'King Bed with Ocean View',
  })
  @IsString()
  @MaxLength(100)
  roomStyle: string;

  @ApiProperty({
    description: 'Booking price per night',
    example: 150.00,
    minimum: 0,
  })
  @IsDecimal()
  @Min(0)
  bookingPrice: number;

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
    example: 'KEY101',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  roomKey?: string;

  @ApiProperty({
    description: 'Hotel ID',
    example: 'hotel_id_here',
  })
  @IsString()
  hotelId: string;
}
