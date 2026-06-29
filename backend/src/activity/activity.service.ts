import { Injectable } from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    userId: string,
    type: ActivityType,
    entityType: string,
    description: string,
    entityId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.prisma.activityLog.create({
      data: {
        userId,
        type,
        entityType,
        entityId,
        description,
        metadata,
      },
    });
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activityLog.count({ where: { userId } }),
    ]);
    return { data, total };
  }

  async findRecent(userId: string, limit = 10) {
    return this.prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
