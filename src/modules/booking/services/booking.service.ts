import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { LoggerService } from '../../../shared/logger/logger.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { UpdateBookingDto } from '../dto/update-booking.dto';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { add, format, differenceInDays, isAfter, isBefore } from 'date-fns';

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly auditService: AuditService,
  ) {}

  async createBooking(createBookingDto: CreateBookingDto, userId: string) {
    try {
      // Check if room exists and is available
      const room = await this.prisma.room.findUnique({
        where: { id: createBookingDto.roomId },
      });

      if (!room) {
        throw new NotFoundException('Room not found');
      }

      // Check room availability
      const isAvailable = await this.checkRoomAvailability(
        createBookingDto.roomId,
        new Date(createBookingDto.checkInDate),
        new Date(createBookingDto.checkOutDate),
      );

      if (!isAvailable) {
        throw new ConflictException('Room is not available for the selected dates');
      }

      // Generate booking number
      const bookingNumber = await this.generateBookingNumber();

      // Calculate total price
      const nights = differenceInDays(
        new Date(createBookingDto.checkOutDate),
        new Date(createBookingDto.checkInDate),
      );
      const totalPrice = room.bookingPrice.toNumber() * nights;

      const booking = await this.prisma.booking.create({
        data: {
          bookingNumber,
          guestId: createBookingDto.guestId,
          userId,
          roomId: createBookingDto.roomId,
          hotelId: room.hotelId,
          checkInDate: new Date(createBookingDto.checkInDate),
          checkOutDate: new Date(createBookingDto.checkOutDate),
          adultsCount: createBookingDto.adultsCount || 1,
          childrenCount: createBookingDto.childrenCount || 0,
          status: BookingStatus.PENDING,
          specialRequests: createBookingDto.specialRequests,
          totalPrice,
          depositAmount: totalPrice * 0.2, // 20% deposit
          paymentStatus: PaymentStatus.PENDING,
          bookingSource: createBookingDto.bookingSource || 'DIRECT',
        },
        include: {
          room: true,
          guest: true,
          hotel: true,
        },
      });

      // Update room status
      await this.prisma.room.update({
        where: { id: createBookingDto.roomId },
        data: { status: 'RESERVED' },
      });

      // Log booking creation
      await this.auditService.logAction({
        action: 'BOOKING_CREATED',
        entity: 'Booking',
        entityId: booking.id,
        userId,
        newValues: {
          bookingNumber,
          roomId: createBookingDto.roomId,
          checkInDate: createBookingDto.checkInDate,
          checkOutDate: createBookingDto.checkOutDate,
          totalPrice,
        },
      });

      this.logger.logBusinessEvent(
        'BOOKING_CREATED',
        booking.id,
        'Booking',
        userId,
        { bookingNumber, totalPrice },
      );

      return booking;
    } catch (error) {
      this.logger.error('Error creating booking', error);
      throw error;
    }
  }

  async getBookingById(id: string, includeRelations = true) {
    try {
      const include = includeRelations
        ? {
            room: true,
            guest: true,
            hotel: true,
            payments: true,
            invoices: true,
          }
        : {};

      return await this.prisma.booking.findUnique({
        where: { id },
        include,
      });
    } catch (error) {
      this.logger.error('Error fetching booking', error);
      throw error;
    }
  }

  async getBookings(filters: {
    hotelId?: string;
    status?: BookingStatus;
    guestId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    try {
      const { page = 1, limit = 20, ...whereFilters } = filters;
      
      const where: any = {};
      
      if (whereFilters.hotelId) {
        where.hotelId = whereFilters.hotelId;
      }
      
      if (whereFilters.status) {
        where.status = whereFilters.status;
      }
      
      if (whereFilters.guestId) {
        where.guestId = whereFilters.guestId;
      }
      
      if (whereFilters.startDate || whereFilters.endDate) {
        where.OR = [
          {
            checkInDate: {
              gte: whereFilters.startDate,
              lte: whereFilters.endDate,
            },
          },
          {
            checkOutDate: {
              gte: whereFilters.startDate,
              lte: whereFilters.endDate,
            },
          },
        ];
      }

      const [bookings, total] = await Promise.all([
        this.prisma.booking.findMany({
          where,
          include: {
            room: true,
            guest: true,
            hotel: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.booking.count({ where }),
      ]);

      return {
        bookings,
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
      this.logger.error('Error fetching bookings', error);
      throw error;
    }
  }

  async updateBooking(id: string, updateBookingDto: UpdateBookingDto, userId: string) {
    try {
      const existingBooking = await this.getBookingById(id);
      
      if (!existingBooking) {
        throw new NotFoundException('Booking not found');
      }

      // Check if booking can be updated (not checked in or cancelled)
      if (existingBooking.status === BookingStatus.CHECKED_IN ||
          existingBooking.status === BookingStatus.CHECKED_OUT ||
          existingBooking.status === BookingStatus.CANCELLED) {
        throw new BadRequestException('Cannot update booking in current status');
      }

      const updateData: any = {};

      if (updateBookingDto.checkInDate) {
        const newCheckInDate = new Date(updateBookingDto.checkInDate);
        if (isAfter(newCheckInDate, existingBooking.checkOutDate)) {
          throw new BadRequestException('Check-in date cannot be after check-out date');
        }
        updateData.checkInDate = newCheckInDate;
      }

      if (updateBookingDto.checkOutDate) {
        const newCheckOutDate = new Date(updateBookingDto.checkOutDate);
        if (isBefore(newCheckOutDate, existingBooking.checkInDate)) {
          throw new BadRequestException('Check-out date cannot be before check-in date');
        }
        updateData.checkOutDate = newCheckOutDate;
      }

      if (updateBookingDto.adultsCount !== undefined) {
        updateData.adultsCount = updateBookingDto.adultsCount;
      }

      if (updateBookingDto.childrenCount !== undefined) {
        updateData.childrenCount = updateBookingDto.childrenCount;
      }

      if (updateBookingDto.specialRequests !== undefined) {
        updateData.specialRequests = updateBookingDto.specialRequests;
      }

      const updatedBooking = await this.prisma.booking.update({
        where: { id },
        data: updateData,
        include: {
          room: true,
          guest: true,
          hotel: true,
        },
      });

      // Log booking update
      await this.auditService.logAction({
        action: 'BOOKING_UPDATED',
        entity: 'Booking',
        entityId: id,
        userId,
        oldValues: {
          checkInDate: existingBooking.checkInDate,
          checkOutDate: existingBooking.checkOutDate,
          adultsCount: existingBooking.adultsCount,
          childrenCount: existingBooking.childrenCount,
        },
        newValues: updateData,
      });

      this.logger.logBusinessEvent(
        'BOOKING_UPDATED',
        id,
        'Booking',
        userId,
        updateData,
      );

      return updatedBooking;
    } catch (error) {
      this.logger.error('Error updating booking', error);
      throw error;
    }
  }

  async updateBookingStatus(id: string, status: BookingStatus, userId: string) {
    try {
      const existingBooking = await this.getBookingById(id);
      
      if (!existingBooking) {
        throw new NotFoundException('Booking not found');
      }

      // Validate status transitions
      this.validateStatusTransition(existingBooking.status, status);

      const updatedBooking = await this.prisma.booking.update({
        where: { id },
        data: {
          status,
          ...(status === BookingStatus.CONFIRMED && { confirmedAt: new Date() }),
          ...(status === BookingStatus.CHECKED_IN && { checkedInAt: new Date() }),
          ...(status === BookingStatus.CHECKED_OUT && { checkedOutAt: new Date() }),
          ...(status === BookingStatus.CANCELLED && { 
            canceledAt: new Date(),
            cancelReason: 'Status updated by staff'
          }),
        },
        include: {
          room: true,
          guest: true,
          hotel: true,
        },
      });

      // Update room status based on booking status
      if (status === BookingStatus.CONFIRMED) {
        await this.prisma.room.update({
          where: { id: existingBooking.roomId },
          data: { status: 'RESERVED' },
        });
      } else if (status === BookingStatus.CHECKED_IN) {
        await this.prisma.room.update({
          where: { id: existingBooking.roomId },
          data: { status: 'OCCUPIED' },
        });
      } else if (status === BookingStatus.CHECKED_OUT) {
        await this.prisma.room.update({
          where: { id: existingBooking.roomId },
          data: { status: 'AVAILABLE' },
        });
        // Trigger housekeeping
        await this.triggerHousekeeping(existingBooking.roomId);
      } else if (status === BookingStatus.CANCELLED) {
        await this.prisma.room.update({
          where: { id: existingBooking.roomId },
          data: { status: 'AVAILABLE' },
        });
      }

      // Log status update
      await this.auditService.logAction({
        action: 'BOOKING_STATUS_UPDATED',
        entity: 'Booking',
        entityId: id,
        userId,
        oldValues: { status: existingBooking.status },
        newValues: { status },
      });

      this.logger.logBusinessEvent(
        'BOOKING_STATUS_UPDATED',
        id,
        'Booking',
        userId,
        { oldStatus: existingBooking.status, newStatus: status },
      );

      return updatedBooking;
    } catch (error) {
      this.logger.error('Error updating booking status', error);
      throw error;
    }
  }

  async cancelBooking(id: string, reason: string, userId: string) {
    try {
      const existingBooking = await this.getBookingById(id);
      
      if (!existingBooking) {
        throw new NotFoundException('Booking not found');
      }

      if (existingBooking.status === BookingStatus.CHECKED_IN) {
        throw new BadRequestException('Cannot cancel checked-in booking');
      }

      if (existingBooking.status === BookingStatus.CANCELLED) {
        throw new BadRequestException('Booking is already cancelled');
      }

      const updatedBooking = await this.prisma.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          canceledAt: new Date(),
          cancelReason: reason,
        },
        include: {
          room: true,
          guest: true,
          hotel: true,
        },
      });

      // Update room status
      await this.prisma.room.update({
        where: { id: existingBooking.roomId },
        data: { status: 'AVAILABLE' },
      });

      // Process refund if payment was made
      if (existingBooking.paymentStatus === PaymentStatus.PAID) {
        // TODO: Process refund through payment service
        this.logger.log(`Refund to be processed for booking ${id}`);
      }

      // Log cancellation
      await this.auditService.logAction({
        action: 'BOOKING_CANCELLED',
        entity: 'Booking',
        entityId: id,
        userId,
        oldValues: { status: existingBooking.status },
        newValues: { status: BookingStatus.CANCELLED, cancelReason: reason },
      });

      this.logger.logBusinessEvent(
        'BOOKING_CANCELLED',
        id,
        'Booking',
        userId,
        { reason, refundAmount: existingBooking.totalPrice },
      );

      return updatedBooking;
    } catch (error) {
      this.logger.error('Error cancelling booking', error);
      throw error;
    }
  }

  async checkInGuest(bookingId: string, checkInData: any, userId: string) {
    try {
      const booking = await this.getBookingById(bookingId);
      
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== BookingStatus.CONFIRMED) {
        throw new BadRequestException('Booking must be confirmed before check-in');
      }

      const updatedBooking = await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CHECKED_IN,
          checkedInAt: new Date(),
        },
        include: {
          room: true,
          guest: true,
          hotel: true,
        },
      });

      // Update room status
      await this.prisma.room.update({
        where: { id: booking.roomId },
        data: { status: 'OCCUPIED' },
      });

      // Log check-in
      await this.auditService.logAction({
        action: 'GUEST_CHECKED_IN',
        entity: 'Booking',
        entityId: bookingId,
        userId,
        newValues: { checkedInAt: new Date(), checkInData },
      });

      this.logger.logBusinessEvent(
        'GUEST_CHECKED_IN',
        bookingId,
        'Booking',
        userId,
        { checkInData },
      );

      return updatedBooking;
    } catch (error) {
      this.logger.error('Error checking in guest', error);
      throw error;
    }
  }

  async checkOutGuest(bookingId: string, checkOutData: any, userId: string) {
    try {
      const booking = await this.getBookingById(bookingId);
      
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== BookingStatus.CHECKED_IN) {
        throw new BadRequestException('Guest must be checked in before check-out');
      }

      const updatedBooking = await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CHECKED_OUT,
          checkedOutAt: new Date(),
        },
        include: {
          room: true,
          guest: true,
          hotel: true,
          payments: true,
        },
      });

      // Update room status
      await this.prisma.room.update({
        where: { id: booking.roomId },
        data: { status: 'AVAILABLE' },
      });

      // Trigger housekeeping
      await this.triggerHousekeeping(booking.roomId);

      // Log check-out
      await this.auditService.logAction({
        action: 'GUEST_CHECKED_OUT',
        entity: 'Booking',
        entityId: bookingId,
        userId,
        newValues: { checkedOutAt: new Date(), checkOutData },
      });

      this.logger.logBusinessEvent(
        'GUEST_CHECKED_OUT',
        bookingId,
        'Booking',
        userId,
        { checkOutData },
      );

      return updatedBooking;
    } catch (error) {
      this.logger.error('Error checking out guest', error);
      throw error;
    }
  }

  private async checkRoomAvailability(
    roomId: string,
    checkInDate: Date,
    checkOutDate: Date,
  ): Promise<boolean> {
    try {
      const conflictingBookings = await this.prisma.booking.findMany({
        where: {
          roomId,
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
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
      });

      return conflictingBookings.length === 0;
    } catch (error) {
      this.logger.error('Error checking room availability', error);
      return false;
    }
  }

  private async generateBookingNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const prefix = `BK${year}${month}${day}`;
    
    // Get the last booking number for today
    const lastBooking = await this.prisma.booking.findFirst({
      where: {
        bookingNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        bookingNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastBooking) {
      const lastSequence = parseInt(lastBooking.bookingNumber.slice(-4));
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  private validateStatusTransition(currentStatus: BookingStatus, newStatus: BookingStatus) {
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      [BookingStatus.CONFIRMED]: [BookingStatus.CHECKED_IN, BookingStatus.CANCELLED],
      [BookingStatus.CHECKED_IN]: [BookingStatus.CHECKED_OUT],
      [BookingStatus.CHECKED_OUT]: [],
      [BookingStatus.CANCELLED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  private async triggerHousekeeping(roomId: string) {
    try {
      await this.prisma.housekeeping.create({
        data: {
          roomId,
          status: 'PENDING',
          priority: 'NORMAL',
          notes: 'Room needs cleaning after guest checkout',
        },
      });
    } catch (error) {
      this.logger.error('Error triggering housekeeping', error);
    }
  }

  async getBookingStatistics(hotelId: string, startDate: Date, endDate: Date) {
    try {
      const [
        totalBookings,
        confirmedBookings,
        checkedInBookings,
        cancelledBookings,
        revenue,
      ] = await Promise.all([
        this.prisma.booking.count({
          where: {
            hotelId,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        this.prisma.booking.count({
          where: {
            hotelId,
            status: BookingStatus.CONFIRMED,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        this.prisma.booking.count({
          where: {
            hotelId,
            status: BookingStatus.CHECKED_IN,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        this.prisma.booking.count({
          where: {
            hotelId,
            status: BookingStatus.CANCELLED,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        this.prisma.booking.aggregate({
          where: {
            hotelId,
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
            createdAt: { gte: startDate, lte: endDate },
          },
          _sum: {
            totalPrice: true,
          },
        }),
      ]);

      return {
        totalBookings,
        confirmedBookings,
        checkedInBookings,
        cancelledBookings,
        totalRevenue: revenue._sum.totalPrice || 0,
        averageBookingValue: totalBookings > 0 ? (revenue._sum.totalPrice || 0) / totalBookings : 0,
        cancellationRate: totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0,
      };
    } catch (error) {
      this.logger.error('Error fetching booking statistics', error);
      throw error;
    }
  }
}
