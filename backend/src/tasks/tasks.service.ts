import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, Prisma, TaskStatus } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto, TaskFilterDto, UpdateTaskDto } from './dto/task.dto';

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, data: CreateTaskDto) {
    return this.prisma.task.create({
      data: { ...data, userId },
      include: { contact: true, company: true },
    });
  }

  findMany(
    userId: string,
    skip: number,
    take: number,
    search?: string,
    filters?: TaskFilterDto,
  ) {
    const where: Prisma.TaskWhereInput = {
      userId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.priority ? { priority: filters.priority } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return Promise.all([
      this.prisma.task.findMany({
        where,
        include: { contact: true, company: true },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.task.count({ where }),
    ]);
  }

  findById(userId: string, id: string) {
    return this.prisma.task.findFirst({
      where: { id, userId },
      include: { contact: true, company: true, notes: true, reminders: true },
    });
  }

  update(userId: string, id: string, data: UpdateTaskDto) {
    const updateData: Prisma.TaskUpdateInput = { ...data };
    if (data.status === TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }
    return this.prisma.task.updateMany({
      where: { id, userId },
      data: updateData,
    });
  }

  delete(userId: string, id: string) {
    return this.prisma.task.deleteMany({ where: { id, userId } });
  }
}

@Injectable()
export class TasksService {
  constructor(
    private readonly repository: TasksRepository,
    private readonly activityService: ActivityService,
  ) {}

  async create(userId: string, dto: CreateTaskDto) {
    const task = await this.repository.create(userId, dto);
    await this.activityService.log(
      userId,
      ActivityType.CREATED,
      'Task',
      `Created task "${task.title}"`,
      task.id,
    );
    return task;
  }

  async findAll(
    userId: string,
    page: number,
    limit: number,
    search?: string,
    filters?: TaskFilterDto,
  ) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.repository.findMany(
      userId,
      skip,
      limit,
      search,
      filters,
    );
    return { data, total };
  }

  async findOne(userId: string, id: string) {
    const task = await this.repository.findById(userId, id);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    await this.findOne(userId, id);
    await this.repository.update(userId, id, dto);
    const task = await this.repository.findById(userId, id);
    const activityType =
      dto.status === TaskStatus.COMPLETED
        ? ActivityType.COMPLETED
        : ActivityType.UPDATED;
    await this.activityService.log(
      userId,
      activityType,
      'Task',
      `Updated task "${task?.title}"`,
      id,
    );
    return task;
  }

  async remove(userId: string, id: string) {
    const task = await this.findOne(userId, id);
    await this.repository.delete(userId, id);
    await this.activityService.log(
      userId,
      ActivityType.DELETED,
      'Task',
      `Deleted task "${task.title}"`,
      id,
    );
    return { success: true };
  }
}
