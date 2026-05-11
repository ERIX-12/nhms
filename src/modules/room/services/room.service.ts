import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { LoggerService } from '../../../shared/logger/logger.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { CreateRoomDto } from '../dto/create-room.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { RoomStatus, RoomType, HousekeepingStatus } from '@prisma/client';
import { isBefore, isAfter, add } from 'date-fns';

@Injectable()
export class RoomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly auditService: AuditService,
  ) {}

  async createRoom(createRoomDto: CreateRoomDto, userId: string) {
    try {
      // Check if room number already exists for this hotel
      const existingRoom = await this.prisma.room.findFirst({
        where: {
          hotelId: createRoomDto.hotelId,
          roomNumber: createRoomDto.roomNumber,
        },
      });

      if (existingRoom) {
        throw new ConflictException('Room with this number already exists in this hotel');
      }

      const room = await this.prisma.room.create({
        data: {
          ...createRoomDto,
          status: RoomStatus.AVAILABLE,
          housekeepingStatus: HousekeepingStatus.PENDING,
          bookingPrice: createRoomDto.bookingPrice,
        },
        include: {
          hotel: true,
        },
      });

      // Update hotel total rooms count
      await this.prisma.hotel.update({
        where: { id: createRoomDto.hotelId },
        data: {
          totalRooms: {
            increment: 1,
          },
        },
      });

      // Log room creation
      await this.auditService.logAction({
        action: 'ROOM_CREATED',
        entity: 'Room',
        entityId: room.id,
        userId,
        newValues: {
          roomNumber: room.roomNumber,
          roomType: room.roomType,
          bookingPrice: room.bookingPrice,
        },
      });

      this.logger.logBusinessEvent(
        'ROOM_CREATED',
        room.id,
        'Room',
        userId,
        { roomNumber: room.roomNumber, roomType: room.roomType },
      );

      return room;
    } catch (error) {
      this.logger.error('Error creating room', error);
      throw error;
    }
  }

  async getRoomById(id: string, includeRelations = true) {
    try {
      const include = includeRelations
        ? {
            hotel: true,
            bookings: {
              where: {
                status: {
                  in: [RoomStatus.CONFIRMED, RoomStatus.CHECKED_IN],
                },
              },
              orderBy: { checkInDate: 'desc' },
              take: 5,
            },
            housekeeping: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          }
        : {};

      return await this.prisma.room.findUnique({
        where: { id },
        include,
      });
    } catch (error) {
      this.logger.error('Error fetching room', error);
      throw error;
    }
  }

  async getRooms(filters: {
    hotelId?: string;
    roomType?: RoomType;
    status?: RoomStatus;
    floor?: number;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
  }) {
    try {
      const { page = 1, limit = 20, ...whereFilters } = filters;
      
      const where: any = {};
      
      if (whereFilters.hotelId) {
        where.hotelId = whereFilters.hotelId;
      }
      
      if (whereFilters.roomType) {
        where.roomType = whereFilters.roomType;
      }
      
      if (whereFilters.status) {
        where.status = whereFilters.status;
      }
      
      if (whereFilters.floor !== undefined) {
        where.floor = whereFilters.floor;
      }
      
      if (whereFilters.minPrice || whereFilters.maxPrice) {
        where.bookingPrice = {};
        if (whereFilters.minPrice) {
          where.bookingPrice.gte = whereFilters.minPrice;
        }
        if (whereFilters.maxPrice) {
          where.bookingPrice.lte = whereFilters.maxPrice;
        }
      }

      const [rooms, total] = await Promise.all([
        this.prisma.room.findMany({
          where,
          include: {
            hotel: true,
            _count: {
              select: {
                bookings: {
                  where: {
                    status: {
                      in: [RoomStatus.CONFIRMED, RoomStatus.CHECKED_IN],
                    },
                  },
                },
              },
            },
          },
          orderBy: [
            { floor: 'asc' },
            { roomNumber: 'asc' },
          ],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.room.count({ where }),
      ]);

      return {
        rooms,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching rooms', error);
      throw error;
    }
  }

  async updateRoom(id: string, updateRoomDto: UpdateRoomDto, userId: string) {
    try {
      const existingRoom = await this.getRoomById(id);
      
      if (!existingRoom) {
        throw new NotFoundException('Room not found');
      }

      // Check if room number conflicts with another room
      if (updateRoomDto.roomNumber) {
        const conflictingRoom = await this.prisma.room.findFirst({
          where: {
            hotelId: existingRoom.hotelId,
            roomNumber: updateRoomDto.roomNumber,
            id: { not: id },
          },
        });

        if (conflictingRoom) {
          throw new ConflictException('Room number already exists in this hotel');
        }
      }

      const updateData: any = { ...updateRoomDto };

      // Update room status if price changes
      if (updateRoomDto.bookingPrice && 
          updateRoomDto.bookingPrice !== existingRoom.bookingPrice) {
        updateData.status = RoomStatus.AVAILABLE;
      }

      const updatedRoom = await this.prisma.room.update({
        where: { id },
        data: updateData,
        include: {
          hotel: true,
        },
      });

      // Log room update
      await this.auditService.logAction({
        action: 'ROOM_UPDATED',
        entity: 'Room',
        entityId: id,
        userId,
        oldValues: {
          roomNumber: existingRoom.roomNumber,
          bookingPrice: existingRoom.bookingPrice,
          status: existingRoom.status,
        },
        newValues: updateData,
      });

      this.logger.logBusinessEvent(
        'ROOM_UPDATED',
        id,
        'Room',
        userId,
        updateData,
      );

      return updatedRoom;
    } catch (error) {
      this.logger.error('Error updating room', error);
      throw error;
    }
  }

  async updateRoomStatus(id: string, status: RoomStatus, userId: string) {
    try {
      const existingRoom = await this.getRoomById(id);
      
      if (!existingRoom) {
        throw new NotFoundException('Room not found');
      }

      // Validate status transitions
      this.validateRoomStatusTransition(existingRoom.status, status);

      const updatedRoom = await this.prisma.room.update({
        where: { id },
        data: { status },
        include: {
          hotel: true,
        },
      });

      // Log status update
      await this.auditService.logAction({
        action: 'ROOM_STATUS_UPDATED',
        entity: 'Room',
        entityId: id,
        userId,
        oldValues: { status: existingRoom.status },
        newValues: { status },
      });

      this.logger.logBusinessEvent(
        'ROOM_STATUS_UPDATED',
        id,
        'Room',
        userId,
        { oldStatus: existingRoom.status, newStatus: status },
      );

      return updatedRoom;
    } catch (error) {
      this.logger.error('Error updating room status', error);
      throw error;
    }
  }

  async deleteRoom(id: string, userId: string) {
    try {
      const existingRoom = await this.getRoomById(id);
      
      if (!existingRoom) {
        throw new NotFoundException('Room not found');
      }

      // Check if room has active bookings
      const activeBookings = await this.prisma.booking.count({
        where: {
          roomId: id,
          status: {
            in: [RoomStatus.CONFIRMED, RoomStatus.CHECKED_IN],
          },
        },
      });

      if (activeBookings > 0) {
        throw new BadRequestException('Cannot delete room with active bookings');
      }

      await this.prisma.room.delete({
        where: { id },
      });

      // Update hotel total rooms count
      await this.prisma.hotel.update({
        where: { id: existingRoom.hotelId },
        data: {
          totalRooms: {
            decrement: 1,
          },
        },
      });

      // Log room deletion
      await this.auditService.logAction({
        action: 'ROOM_DELETED',
        entity: 'Room',
        entityId: id,
        userId,
        oldValues: existingRoom,
      });

      this.logger.logBusinessEvent(
        'ROOM_DELETED',
        id,
        'Room',
        userId,
        { roomNumber: existingRoom.roomNumber },
      );

      return { message: 'Room deleted successfully' };
    } catch (error) {
      this.logger.error('Error deleting room', error);
      throw error;
    }
  }

  async checkRoomAvailability(
    hotelId: string,
    checkInDate: Date,
    checkOutDate: Date,
    adults: number,
    children: number = 0,
    roomType?: RoomType,
  ) {
    try {
      const where: any = {
        hotelId,
        status: RoomStatus.AVAILABLE,
        maxAdults: { gte: adults },
        maxChildren: { gte: children },
      };

      if (roomType) {
        where.roomType = roomType;
      }

      // Find rooms that are NOT booked during the requested period
      const unavailableRoomIds = await this.getUnavailableRoomIds(checkInDate, checkOutDate);
      
      if (unavailableRoomIds.length > 0) {
        where.id = { notIn: unavailableRoomIds };
      }

      const availableRooms = await this.prisma.room.findMany({
        where,
        include: {
          hotel: true,
          _count: {
            select: {
              bookings: true,
            },
          },
        },
        orderBy: [
          { roomType: 'asc' },
          { floor: 'asc' },
          { roomNumber: 'asc' },
        ],
      });

      return availableRooms;
    } catch (error) {
      this.logger.error('Error checking room availability', error);
      throw error;
    }
  }

  async getRoomStatistics(hotelId: string) {
    try {
      const [
        totalRooms,
        availableRooms,
        occupiedRooms,
        reservedRooms,
        maintenanceRooms,
        roomTypes,
      ] = await Promise.all([
        this.prisma.room.count({
          where: { hotelId },
        }),
        this.prisma.room.count({
          where: { hotelId, status: RoomStatus.AVAILABLE },
        }),
        this.prisma.room.count({
          where: { hotelId, status: RoomStatus.OCCUPIED },
        }),
        this.prisma.room.count({
          where: { hotelId, status: RoomStatus.RESERVED },
        }),
        this.prisma.room.count({
          where: { hotelId, status: RoomStatus.UNDER_MAINTENANCE },
        }),
        this.prisma.room.groupBy({
          where: { hotelId },
          by: ['roomType'],
          _count: true,
        }),
      ]);

      const roomTypeStats = roomTypes.reduce((acc, item) => {
        acc[item.roomType] = item._count;
        return acc;
      }, {});

      const averagePrice = await this.prisma.room.aggregate({
        where: { hotelId },
        _avg: {
          bookingPrice: true,
        },
      });

      return {
        totalRooms,
        availableRooms,
        occupiedRooms,
        reservedRooms,
        maintenanceRooms,
        occupancyRate: totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0,
        averagePrice: averagePrice._avg.bookingPrice || 0,
        roomTypeDistribution: roomTypeStats,
      };
    } catch (error) {
      this.logger.error('Error fetching room statistics', error);
      throw error;
    }
  }

  private async getUnavailableRoomIds(checkInDate: Date, checkOutDate: Date): Promise<string[]> {
    try {
      const bookedRooms = await this.prisma.booking.findMany({
        where: {
          status: {
            in: [RoomStatus.CONFIRMED, RoomStatus.CHECKED_IN],
          },
          OR: [
            {
              checkInDate: { lt: checkOutDate },
              checkOutDate: { gt: checkInDate },
            },
            {
              checkInDate: { gte: checkInDate, lt: checkOutDate },
            },
            {
              checkOutDate: { gt: checkInDate, lte: checkOutDate },
            },
          ],
        },
        select: { roomId: true },
      });

      return [...new Set(bookedRooms.map(booking => booking.roomId))];
    } catch (error) {
      this.logger.error('Error getting unavailable room IDs', error);
      return [];
    }
  }

  private validateRoomStatusTransition(currentStatus: RoomStatus, newStatus: RoomStatus) {
    const validTransitions: Record<RoomStatus, RoomStatus[]> = {
      [RoomStatus.AVAILABLE]: [RoomStatus.RESERVED, RoomStatus.UNDER_MAINTENANCE, RoomStatus.CLEANING],
      [RoomStatus.RESERVED]: [RoomStatus.AVAILABLE, RoomStatus.CONFIRMED, RoomStatus.CANCELLED],
      [RoomStatus.UNDER_MAINTENANCE]: [RoomStatus.AVAILABLE],
      [RoomStatus.CLEANING]: [RoomStatus.AVAILABLE],
      [RoomStatus.OCCUPIED]: [RoomStatus.AVAILABLE],
      [RoomStatus.OUT_OF_SERVICE]: [RoomStatus.AVAILABLE],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(`Invalid room status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  async updateHousekeepingStatus(roomId: string, status: HousekeepingStatus, notes?: string) {
    try {
      const room = await this.prisma.room.findUnique({
        where: { id: roomId },
      });

      if (!room) {
        throw new NotFoundException('Room not found');
      }

      // Update room housekeeping status
      await this.prisma.room.update({
        where: { id: roomId },
        data: {
          housekeepingStatus: status,
          ...(status === HousekeepingStatus.CLEANED && { lastCleanedAt: new Date() }),
        },
      });

      // Create or update housekeeping record
      const existingHousekeeping = await this.prisma.housekeeping.findFirst({
        where: {
          roomId,
          status: {
            in: [HousekeepingStatus.PENDING, HousekeepingStatus.IN_PROGRESS],
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingHousekeeping) {
        await this.prisma.housekeeping.update({
          where: { id: existingHousekeeping.id },
          data: {
            status,
            notes,
            ...(status === HousekeepingStatus.CLEANED && { completedAt: new Date() }),
          },
        });
      } else {
        await this.prisma.housekeeping.create({
          data: {
            roomId,
            hotelId: room.hotelId,
            status,
            notes,
            ...(status === HousekeepingStatus.CLEANED && { completedAt: new Date() }),
          },
        });
      }

      return { message: 'Housekeeping status updated successfully' };
    } catch (error) {
      this.logger.error('Error updating housekeeping status', error);
      throw error;
    }
  }
}
