import { IsString, IsOptional, IsDecimal, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Booking ID',
    example: 'booking_id_here',
  })
  @IsString()
  bookingId: string;

  @ApiPropertyOptional({
    description: 'Invoice ID',
    example: 'invoice_id_here',
  })
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 150.00,
    minimum: 0,
  })
  @IsDecimal()
  amount: number;

  @ApiProperty({
    description: 'Payment method',
    enum: ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'CHECK', 'MOBILE_MONEY', 'BANK_TRANSFER', 'ONLINE_PAYMENT'],
    example: 'CREDIT_CARD',
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Payment gateway',
    example: 'stripe',
  })
  @IsOptional()
  @IsString()
  gateway?: string;

  @ApiPropertyOptional({
    description: 'Transaction ID from payment gateway',
    example: 'txn_123456789',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Gateway response data',
    example: '{ success: true, charge_id: "ch_123456" }',
  })
  @IsOptional()
  gatewayResponse?: any;
}
