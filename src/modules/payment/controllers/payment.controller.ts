import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { Request as ExpressRequest } from 'express';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new payment' })
  @ApiResponse({ status: 201, description: 'Payment created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const payment = await this.paymentService.createPayment(createPaymentDto, user.id);
    
    return {
      success: true,
      statusCode: 201,
      message: 'Payment created successfully',
      data: payment,
    };
  }

  @Post(':id/process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process payment' })
  @ApiResponse({ status: 200, description: 'Payment processed successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async processPayment(
    @Param('id') id: string,
    @Body() body: { gatewayResponse: any },
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const payment = await this.paymentService.processPayment(id, body.gatewayResponse, user.id);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Payment processed successfully',
      data: payment,
    };
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Refund payment' })
  @ApiResponse({ status: 200, description: 'Payment refunded successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async refundPayment(
    @Param('id') id: string,
    @Body() body: { refundAmount: number; reason: string },
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const payment = await this.paymentService.refundPayment(id, body.refundAmount, body.reason, user.id);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Payment refunded successfully',
      data: payment,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all payments with filters' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  @ApiQuery({ name: 'bookingId', required: false, description: 'Filter by booking ID' })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus, description: 'Filter by payment status' })
  @ApiQuery({ name: 'method', required: false, enum: PaymentMethod, description: 'Filter by payment method' })
  @ApiQuery({ name: 'gateway', required: false, description: 'Filter by payment gateway' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter by start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter by end date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20)' })
  async getPayments(
    @Query() filters: any,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    
    // Add hotel filter based on user's hotel if not provided
    if (user.hotelId && !filters.hotelId) {
      filters.hotelId = user.hotelId;
    }
    
    const result = await this.paymentService.getPayments(filters);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Payments retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentById(@Param('id') id: string) {
    const payment = await this.paymentService.getPaymentById(id);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Payment retrieved successfully',
      data: payment,
    };
  }

  @Get('statistics')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get payment statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiQuery({ name: 'hotelId', required: false, description: 'Hotel ID' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'End date (YYYY-MM-DD)' })
  async getPaymentStatistics(
    @Query() query: { hotelId?: string; startDate: string; endDate: string },
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const hotelId = query.hotelId || user.hotelId;
    
    const statistics = await this.paymentService.getPaymentStatistics(
      hotelId,
      new Date(query.startDate),
      new Date(query.endDate),
    );
    
    return {
      success: true,
      statusCode: 200,
      message: 'Statistics retrieved successfully',
      data: statistics,
    };
  }
}
