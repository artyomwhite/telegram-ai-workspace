import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  async create(userId: string, dto: CreateNoteDto) {
    const note = await this.prisma.note.create({
      data: { ...dto, userId },
      include: { task: true },
    });
    await this.activityService.log(
      userId,
      ActivityType.CREATED,
      'Note',
      `Created note "${note.title}"`,
      note.id,
    );
    return note;
  }

  async findAll(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.note.findMany({
        where: { userId },
        include: { task: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.note.count({ where: { userId } }),
    ]);
    return { data, total };
  }

  async findOne(userId: string, id: string) {
    const note = await this.prisma.note.findFirst({
      where: { id, userId },
      include: { task: true },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    return note;
  }

  async update(userId: string, id: string, dto: UpdateNoteDto) {
    await this.findOne(userId, id);
    const note = await this.prisma.note.update({
      where: { id },
      data: dto,
      include: { task: true },
    });
    await this.activityService.log(
      userId,
      ActivityType.UPDATED,
      'Note',
      `Updated note "${note.title}"`,
      id,
    );
    return note;
  }

  async remove(userId: string, id: string) {
    const note = await this.findOne(userId, id);
    await this.prisma.note.delete({ where: { id } });
    await this.activityService.log(
      userId,
      ActivityType.DELETED,
      'Note',
      `Deleted note "${note.title}"`,
      id,
    );
    return { success: true };
  }
}
