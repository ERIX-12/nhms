import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '../logger/logger.service';

export interface AuditAction {
  action: string;
  entity: string;
  entityId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  oldValues?: any;
  newValues?: any;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async logAction(action: AuditAction): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: action.action,
          entity: action.entity,
          entityId: action.entityId,
          userId: action.userId,
          ipAddress: action.ipAddress,
          userAgent: action.userAgent,
          oldValues: action.oldValues,
          newValues: action.newValues,
        },
      });
    } catch (error) {
      this.logger.error('Error logging audit action', error);
    }
  }

  async getAuditLogs(filters: {
    userId?: string;
    entity?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    try {
      const { page = 1, limit = 50, ...whereFilters } = filters;
      
      const where: any = {};
      
      if (whereFilters.userId) {
        where.userId = whereFilters.userId;
      }
      
      if (whereFilters.entity) {
        where.entity = whereFilters.entity;
      }
      
      if (whereFilters.action) {
        where.action = whereFilters.action;
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

      const [logs, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      return {
        logs,
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
      this.logger.error('Error fetching audit logs', error);
      throw error;
    }
  }

  async getAuditLogById(id: string) {
    try {
      return await this.prisma.auditLog.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error('Error fetching audit log', error);
      throw error;
    }
  }

  async cleanupOldLogs(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} old audit logs older than ${daysToKeep} days`);
    } catch (error) {
      this.logger.error('Error cleaning up old audit logs', error);
    }
  }
}
