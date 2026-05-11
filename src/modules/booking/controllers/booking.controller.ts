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
import { BookingService } from '../services/booking.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { UpdateBookingDto } from '../dto/update-booking.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { BookingStatus } from '@prisma/client';
import { Request as ExpressRequest } from 'express';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({ status: 201, description: 'Booking created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Room not available' })
  async createBooking(
    @Body() createBookingDto: CreateBookingDto,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const booking = await this.bookingService.createBooking(createBookingDto, user.id);
    
    return {
      success: true,
      statusCode: 201,
      message: 'Booking created successfully',
      data: booking,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all bookings with filters' })
  @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
  @ApiQuery({ name: 'hotelId', required: false, description: 'Filter by hotel ID' })
  @ApiQuery({ name: 'status', required: false, enum: BookingStatus, description: 'Filter by booking status' })
  @ApiQuery({ name: 'guestId', required: false, description: 'Filter by guest ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter by start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter by end date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20)' })
  async getBookings(
    @Query() filters: any,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    
    // Add hotel ID filter based on user's hotel
    if (user.hotelId && !filters.hotelId) {
      filters.hotelId = user.hotelId;
    }
    
    const result = await this.bookingService.getBookings(filters);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Bookings retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiResponse({ status: 200, description: 'Booking retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBookingById(@Param('id') id: string) {
    const booking = await this.bookingService.getBookingById(id);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Booking retrieved successfully',
      data: booking,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update booking' })
  @ApiResponse({ status: 200, description: 'Booking updated successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async updateBooking(
    @Param('id') id: string,
    @Body() updateBookingDto: UpdateBookingDto,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const booking = await this.bookingService.updateBooking(id, updateBookingDto, user.id);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Booking updated successfully',
      data: booking,
    };
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update booking status' })
  @ApiResponse({ status: 200, description: 'Booking status updated successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  async updateBookingStatus(
    @Param('id') id: string,
    @Body() body: { status: BookingStatus },
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const booking = await this.bookingService.updateBookingStatus(id, body.status, user.id);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Booking status updated successfully',
      data: booking,
    };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel booking' })
  @ApiResponse({ status: 200, description: 'Booking cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 400, description: 'Cannot cancel booking in current status' })
  async cancelBooking(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const booking = await this.bookingService.cancelBooking(id, body.reason, user.id);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Booking cancelled successfully',
      data: booking,
    };
  }

  @Post(':id/checkin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check in guest' })
  @ApiResponse({ status: 200, description: 'Guest checked in successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 400, description: 'Cannot check in guest for this booking' })
  async checkInGuest(
    @Param('id') id: string,
    @Body() checkInData: any,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const booking = await this.bookingService.checkInGuest(id, checkInData, user.id);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Guest checked in successfully',
      data: booking,
    };
  }

  @Post(':id/checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check out guest' })
  @ApiResponse({ status: 200, description: 'Guest checked out successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 400, description: 'Cannot check out guest for this booking' })
  async checkOutGuest(
    @Param('id') id: string,
    @Body() checkOutData: any,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const booking = await this.bookingService.checkOutGuest(id, checkOutData, user.id);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Guest checked out successfully',
      data: booking,
    };
  }

  @Get('statistics')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get booking statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiQuery({ name: 'hotelId', required: false, description: 'Hotel ID' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'End date (YYYY-MM-DD)' })
  async getBookingStatistics(
    @Query() query: { hotelId: string; startDate: string; endDate: string },
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const hotelId = query.hotelId || user.hotelId;
    
    const statistics = await this.bookingService.getBookingStatistics(
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
