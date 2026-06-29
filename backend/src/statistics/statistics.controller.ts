import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Statistics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('statistics')
export class StatisticsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  @Get()
  async getStatistics(@CurrentUser() user: { id: string }) {
    const userId = user.id;

    const [
      contacts,
      companies,
      tasks,
      openTasks,
      inProgressTasks,
      completedTasks,
      pendingReminders,
      notes,
      telegramConnected,
      recentActivity,
    ] = await Promise.all([
      this.prisma.contact.count({ where: { userId } }),
      this.prisma.company.count({ where: { userId } }),
      this.prisma.task.count({ where: { userId } }),
      this.prisma.task.count({ where: { userId, status: TaskStatus.TODO } }),
      this.prisma.task.count({
        where: { userId, status: TaskStatus.IN_PROGRESS },
      }),
      this.prisma.task.count({
        where: { userId, status: TaskStatus.COMPLETED },
      }),
      this.prisma.reminder.count({
        where: { userId, status: 'PENDING' },
      }),
      this.prisma.note.count({ where: { userId } }),
      this.prisma.telegramConnection.findFirst({
        where: { userId, isActive: true },
      }),
      this.activityService.findRecent(userId, 5),
    ]);

    return {
      contacts,
      companies,
      tasks: {
        total: tasks,
        open: openTasks,
        inProgress: inProgressTasks,
        completed: completedTasks,
      },
      reminders: { pending: pendingReminders },
      notes,
      telegram: {
        connected: !!telegramConnected,
        username: telegramConnected?.telegramUsername ?? null,
        connectedAt: telegramConnected?.connectedAt ?? null,
      },
      recentActivity,
    };
  }
}
