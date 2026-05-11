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
import { RoomService } from '../services/room.service';
import { CreateRoomDto } from '../dto/create-room.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoomType, RoomStatus } from '@prisma/client';
import { Request as ExpressRequest } from 'express';

@ApiTags('Rooms')
@Controller('rooms')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Create a new room' })
  @ApiResponse({ status: 201, description: 'Room created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Room number already exists' })
  async createRoom(
    @Body() createRoomDto: CreateRoomDto,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const room = await this.roomService.createRoom(createRoomDto, user.id);
    
    return {
      success: true,
      statusCode: 201,
      message: 'Room created successfully',
      data: room,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all rooms with filters' })
  @ApiResponse({ status: 200, description: 'Rooms retrieved successfully' })
  @ApiQuery({ name: 'hotelId', required: false, description: 'Filter by hotel ID' })
  @ApiQuery({ name: 'roomType', required: false, enum: RoomType, description: 'Filter by room type' })
  @ApiQuery({ name: 'status', required: false, enum: RoomStatus, description: 'Filter by room status' })
  @ApiQuery({ name: 'floor', required: false, description: 'Filter by floor number' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum price' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum price' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20)' })
  async getRooms(
    @Query() filters: any,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    
    // Add hotel ID filter based on user's hotel
    if (user.hotelId && !filters.hotelId) {
      filters.hotelId = user.hotelId;
    }
    
    const result = await this.roomService.getRooms(filters);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Rooms retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room by ID' })
  @ApiResponse({ status: 200, description: 'Room retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async getRoomById(@Param('id') id: string) {
    const room = await this.roomService.getRoomById(id);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Room retrieved successfully',
      data: room,
    };
  }

  @Put(':id')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Update room' })
  @ApiResponse({ status: 200, description: 'Room updated successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateRoom(
    @Param('id') id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const room = await this.roomService.updateRoom(id, updateRoomDto, user.id);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Room updated successfully',
      data: room,
    };
  }

  @Put(':id/status')
  @Roles('MANAGER', 'ADMIN', 'RECEPTIONIST', 'HOUSEKEEPER')
  @ApiOperation({ summary: 'Update room status' })
  @ApiResponse({ status: 200, description: 'Room status updated successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateRoomStatus(
    @Param('id') id: string,
    @Body() body: { status: RoomStatus },
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const room = await this.roomService.updateRoomStatus(id, body.status, user.id);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Room status updated successfully',
      data: room,
    };
  }

  @Delete(':id')
  @Roles('MANAGER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete room' })
  @ApiResponse({ status: 200, description: 'Room deleted successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete room with active bookings' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async deleteRoom(
    @Param('id') id: string,
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const result = await this.roomService.deleteRoom(id, user.id);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Room deleted successfully',
      data: result,
    };
  }

  @Get('available')
  @ApiOperation({ summary: 'Check room availability' })
  @ApiResponse({ status: 200, description: 'Available rooms retrieved successfully' })
  @ApiQuery({ name: 'hotelId', required: false, description: 'Hotel ID' })
  @ApiQuery({ name: 'checkInDate', required: true, description: 'Check-in date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'checkOutDate', required: true, description: 'Check-out date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'adults', required: true, description: 'Number of adults' })
  @ApiQuery({ name: 'children', required: false, description: 'Number of children' })
  @ApiQuery({ name: 'roomType', required: false, enum: RoomType, description: 'Room type preference' })
  async checkAvailability(
    @Query() query: {
      hotelId: string;
      checkInDate: string;
      checkOutDate: string;
      adults: number;
      children?: number;
      roomType?: RoomType;
    },
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const hotelId = query.hotelId || user.hotelId;
    
    const availableRooms = await this.roomService.checkRoomAvailability(
      hotelId,
      new Date(query.checkInDate),
      new Date(query.checkOutDate),
      query.adults,
      query.children,
      query.roomType,
    );
    
    return {
      success: true,
      statusCode: 200,
      message: 'Available rooms retrieved successfully',
      data: availableRooms,
    };
  }

  @Get('statistics')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get room statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiQuery({ name: 'hotelId', required: false, description: 'Hotel ID' })
  async getRoomStatistics(
    @Query() query: { hotelId?: string },
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const hotelId = query.hotelId || user.hotelId;
    
    const statistics = await this.roomService.getRoomStatistics(hotelId);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Statistics retrieved successfully',
      data: statistics,
    };
  }

  @Put(':id/housekeeping')
  @Roles('HOUSEKEEPER', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Update room housekeeping status' })
  @ApiResponse({ status: 200, description: 'Housekeeping status updated successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateHousekeepingStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
    @Request() req: ExpressRequest,
  ) {
    const user = req.user as any;
    const result = await this.roomService.updateHousekeepingStatus(id, body.status, body.notes);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Housekeeping status updated successfully',
      data: result,
    };
  }
}
