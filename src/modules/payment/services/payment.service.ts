import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { LoggerService } from '../../../shared/logger/logger.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async createPayment(createPaymentDto: CreatePaymentDto, userId: string) {
    try {
      // Validate booking exists and payment can be made
      const booking = await this.prisma.booking.findUnique({
        where: { id: createPaymentDto.bookingId },
        include: {
          payments: true,
          invoices: true,
        },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      // Check if payment amount matches booking total
      const totalPaid = booking.payments.reduce((sum, payment) => 
        sum + payment.amount.toNumber(), 0
      );

      if (totalPaid + createPaymentDto.amount > booking.totalPrice.toNumber()) {
        throw new BadRequestException('Payment amount exceeds booking total');
      }

      // Generate payment number
      const paymentNumber = await this.generatePaymentNumber();

      const payment = await this.prisma.payment.create({
        data: {
          paymentNumber,
          bookingId: createPaymentDto.bookingId,
          invoiceId: createPaymentDto.invoiceId,
          amount: createPaymentDto.amount,
          method: createPaymentDto.method,
          status: PaymentStatus.PENDING,
          gateway: createPaymentDto.gateway,
          transactionId: createPaymentDto.transactionId,
          gatewayResponse: createPaymentDto.gatewayResponse,
          processedBy: userId,
        },
        include: {
          booking: {
            include: {
              guest: true,
              hotel: true,
            },
          },
        },
      });

      // Log payment creation
      await this.auditService.logAction({
        action: 'PAYMENT_CREATED',
        entity: 'Payment',
        entityId: payment.id,
        userId,
        newValues: {
          paymentNumber,
          amount: createPaymentDto.amount,
          method: createPaymentDto.method,
          gateway: createPaymentDto.gateway,
        },
      });

      this.logger.logBusinessEvent(
        'PAYMENT_CREATED',
        payment.id,
        'Payment',
        userId,
        { 
          paymentNumber, 
          amount: createPaymentDto.amount, 
          method: createPaymentDto.method,
          gateway: createPaymentDto.gateway 
        },
      );

      return payment;
    } catch (error) {
      this.logger.error('Error creating payment', error);
      throw error;
    }
  }

  async processPayment(paymentId: string, gatewayResponse: any, userId: string) {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          booking: {
            include: {
              guest: true,
              hotel: true,
            },
          },
        },
      },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException('Payment cannot be processed in current status');
      }

      // Update payment status
      const updatedPayment = await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PAID,
          gatewayResponse,
          processedAt: new Date(),
        },
        include: {
          booking: {
            include: {
              guest: true,
              hotel: true,
            },
          },
        },
      },
      });

      // Update booking payment status
      const totalPaid = await this.calculateTotalPaid(payment.bookingId);
      const bookingTotal = payment.booking.totalPrice.toNumber();

      let bookingPaymentStatus: PaymentStatus;
      if (totalPaid >= bookingTotal) {
        bookingPaymentStatus = PaymentStatus.PAID;
      } else if (totalPaid > 0) {
        bookingPaymentStatus = PaymentStatus.PARTIAL;
      } else {
        bookingPaymentStatus = PaymentStatus.PENDING;
      }

      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: bookingPaymentStatus },
      });

      // Log payment processing
      await this.auditService.logAction({
        action: 'PAYMENT_PROCESSED',
        entity: 'Payment',
        entityId: paymentId,
        userId,
        newValues: {
          status: PaymentStatus.PAID,
          processedAt: new Date(),
          gatewayResponse,
        },
      });

      this.logger.logBusinessEvent(
        'PAYMENT_PROCESSED',
        paymentId,
        'Payment',
        userId,
        { 
          status: PaymentStatus.PAID, 
          amount: payment.amount,
          gateway: payment.gateway,
          bookingPaymentStatus 
        },
      );

      return updatedPayment;
    } catch (error) {
      this.logger.error('Error processing payment', error);
      throw error;
    }
  }

  async refundPayment(paymentId: string, refundAmount: number, reason: string, userId: string) {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          booking: {
            include: {
              guest: true,
              hotel: true,
            },
          },
        },
      },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status !== PaymentStatus.PAID) {
        throw new BadRequestException('Only paid payments can be refunded');
      }

      if (refundAmount > payment.amount.toNumber()) {
        throw new BadRequestException('Refund amount cannot exceed payment amount');
      }

      // Process refund through gateway (simplified for demo)
      const refundResult = await this.processGatewayRefund(payment, refundAmount);

      // Update payment record
      const updatedPayment = await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REFUNDED,
          refundAmount,
          refundReason: reason,
          refundedAt: new Date(),
          gatewayResponse: refundResult,
        },
        include: {
          booking: {
            include: {
              guest: true,
              hotel: true,
            },
          },
        },
      },
      });

      // Update booking payment status
      const totalPaid = await this.calculateTotalPaid(payment.bookingId) - refundAmount;
      const bookingTotal = payment.booking.totalPrice.toNumber();

      let bookingPaymentStatus: PaymentStatus;
      if (totalPaid >= bookingTotal) {
        bookingPaymentStatus = PaymentStatus.PAID;
      } else if (totalPaid > 0) {
        bookingPaymentStatus = PaymentStatus.PARTIAL;
      } else {
        bookingPaymentStatus = PaymentStatus.REFUNDED;
      }

      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: bookingPaymentStatus },
      });

      // Log refund
      await this.auditService.logAction({
        action: 'PAYMENT_REFUNDED',
        entity: 'Payment',
        entityId: paymentId,
        userId,
        newValues: {
          refundAmount,
          refundReason,
          refundedAt: new Date(),
        },
      });

      this.logger.logBusinessEvent(
        'PAYMENT_REFUNDED',
        paymentId,
        'Payment',
        userId,
        { 
          refundAmount, 
          reason,
          gatewayResponse: refundResult 
        },
      );

      return updatedPayment;
    } catch (error) {
      this.logger.error('Error refunding payment', error);
      throw error;
    }
  }

  async getPayments(filters: {
    bookingId?: string;
    status?: PaymentStatus;
    method?: PaymentMethod;
    gateway?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    try {
      const { page = 1, limit = 20, ...whereFilters } = filters;
      
      const where: any = {};
      
      if (whereFilters.bookingId) {
        where.bookingId = whereFilters.bookingId;
      }
      
      if (whereFilters.status) {
        where.status = whereFilters.status;
      }
      
      if (whereFilters.method) {
        where.method = whereFilters.method;
      }
      
      if (whereFilters.gateway) {
        where.gateway = whereFilters.gateway;
      }
      
      if (whereFilters.startDate || whereFilters.endDate) {
        where.createdAt = {};
        if (whereFilters.startDate) {
          where.createdAt.gte = whereFilters.startDate;
        }
        if (whereFilters.endDate) {
          where.createdAt.lte = whereFilters.endDate;
        }
      }

      const [payments, total] = await Promise.all([
        this.prisma.payment.findMany({
          where,
          include: {
            booking: {
              include: {
                guest: true,
                hotel: true,
              },
            },
          },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.payment.count({ where }),
      ]);

      return {
        payments,
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
      this.logger.error('Error fetching payments', error);
      throw error;
    }
  }

  async getPaymentById(id: string) {
    try {
      return await this.prisma.payment.findUnique({
        where: { id },
        include: {
          booking: {
            include: {
              guest: true,
              hotel: true,
            },
          },
          invoices: true,
        },
      });
    } catch (error) {
      this.logger.error('Error fetching payment', error);
      throw error;
    }
  }

  async getPaymentStatistics(hotelId: string, startDate: Date, endDate: Date) {
    try {
      const [
        totalPayments,
        successfulPayments,
        failedPayments,
        refundedPayments,
        revenue,
        methodStats,
        gatewayStats,
      ] = await Promise.all([
        this.prisma.payment.count({
          where: {
            booking: { hotelId },
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        this.prisma.payment.count({
          where: {
            booking: { hotelId },
            status: PaymentStatus.PAID,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        this.prisma.payment.count({
          where: {
            booking: { hotelId },
            status: PaymentStatus.FAILED,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        this.prisma.payment.count({
          where: {
            booking: { hotelId },
            status: PaymentStatus.REFUNDED,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        this.prisma.payment.aggregate({
          where: {
            booking: { hotelId },
            status: PaymentStatus.PAID,
            createdAt: { gte: startDate, lte: endDate },
          },
          _sum: {
            amount: true,
          },
        }),
        this.prisma.payment.groupBy({
          where: {
            booking: { hotelId },
            createdAt: { gte: startDate, lte: endDate },
          },
          by: ['method'],
          _count: true,
          _sum: {
            amount: true,
          },
        }),
        this.prisma.payment.groupBy({
          where: {
            booking: { hotelId },
            createdAt: { gte: startDate, lte: endDate },
          },
          by: ['gateway'],
          _count: true,
          _sum: {
            amount: true,
          },
        }),
      ]);

      const methodDistribution = methodStats.reduce((acc, item) => {
        acc[item.method] = {
          count: item._count,
          total: item._sum.amount,
        };
        return acc;
      }, {});

      const gatewayDistribution = gatewayStats.reduce((acc, item) => {
        acc[item.gateway] = {
          count: item._count,
          total: item._sum.amount,
        };
        return acc;
      }, {});

      return {
        totalPayments,
        successfulPayments,
        failedPayments,
        refundedPayments,
        totalRevenue: revenue._sum.amount || 0,
        averagePaymentAmount: successfulPayments > 0 ? (revenue._sum.amount || 0) / successfulPayments : 0,
        successRate: totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0,
        failureRate: totalPayments > 0 ? (failedPayments / totalPayments) * 100 : 0,
        refundRate: totalPayments > 0 ? (refundedPayments / totalPayments) * 100 : 0,
        methodDistribution,
        gatewayDistribution,
      };
    } catch (error) {
      this.logger.error('Error fetching payment statistics', error);
      throw error;
    }
  }

  private async generatePaymentNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const prefix = `PAY${year}${month}${day}`;
    
    // Get the last payment number for today
    const lastPayment = await this.prisma.payment.findFirst({
      where: {
        paymentNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        paymentNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastPayment) {
      const lastSequence = parseInt(lastPayment.paymentNumber.slice(-4));
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  private async calculateTotalPaid(bookingId: string): Promise<number> {
    const payments = await this.prisma.payment.findMany({
      where: {
        bookingId,
        status: {
          in: [PaymentStatus.PAID, PaymentStatus.PARTIAL],
        },
      },
    });

    return payments.reduce((total, payment) => 
      total + payment.amount.toNumber(), 0
    );
  }

  private async processGatewayRefund(payment: any, amount: number): Promise<any> {
    // Simplified gateway refund processing
    // In production, this would integrate with actual payment gateways
    const gateway = payment.gateway.toLowerCase();
    
    switch (gateway) {
      case 'stripe':
        return await this.processStripeRefund(payment, amount);
      case 'paypal':
        return await this.processPayPalRefund(payment, amount);
      default:
        return { success: true, refundId: `refund_${Date.now()}` };
    }
  }

  private async processStripeRefund(payment: any, amount: number): Promise<any> {
    // Stripe refund implementation
    const stripeSecret = this.configService.get<string>('payment.stripe.secretKey');
    
    // This would use Stripe SDK to process refund
    // For demo purposes, returning mock response
    return {
      success: true,
      refundId: `re_${payment.paymentNumber}`,
      amount,
    };
  }

  private async processPayPalRefund(payment: any, amount: number): Promise<any> {
    // PayPal refund implementation
    const paypalConfig = {
      clientId: this.configService.get<string>('payment.paypal.clientId'),
      clientSecret: this.configService.get<string>('payment.paypal.clientSecret'),
      mode: this.configService.get<string>('payment.paypal.mode'),
    };
    
    // This would use PayPal SDK to process refund
    // For demo purposes, returning mock response
    return {
      success: true,
      refundId: `pp_${payment.paymentNumber}`,
      amount,
    };
  }
}
