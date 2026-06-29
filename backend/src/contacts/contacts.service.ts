import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@Injectable()
export class ContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, data: CreateContactDto) {
    return this.prisma.contact.create({
      data: { ...data, userId },
      include: { company: true },
    });
  }

  findMany(userId: string, skip: number, take: number, search?: string) {
    const where: Prisma.ContactWhereInput = {
      userId,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return Promise.all([
      this.prisma.contact.findMany({
        where,
        include: { company: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.contact.count({ where }),
    ]);
  }

  findById(userId: string, id: string) {
    return this.prisma.contact.findFirst({
      where: { id, userId },
      include: { company: true },
    });
  }

  update(userId: string, id: string, data: UpdateContactDto) {
    return this.prisma.contact.updateMany({
      where: { id, userId },
      data,
    });
  }

  delete(userId: string, id: string) {
    return this.prisma.contact.deleteMany({ where: { id, userId } });
  }
}

@Injectable()
export class ContactsService {
  constructor(
    private readonly repository: ContactsRepository,
    private readonly activityService: ActivityService,
  ) {}

  async create(userId: string, dto: CreateContactDto) {
    const contact = await this.repository.create(userId, dto);
    await this.activityService.log(
      userId,
      ActivityType.CREATED,
      'Contact',
      `Created contact ${contact.firstName} ${contact.lastName}`,
      contact.id,
    );
    return contact;
  }

  async findAll(userId: string, page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.repository.findMany(
      userId,
      skip,
      limit,
      search,
    );
    return { data, total };
  }

  async findOne(userId: string, id: string) {
    const contact = await this.repository.findById(userId, id);
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  async update(userId: string, id: string, dto: UpdateContactDto) {
    await this.findOne(userId, id);
    await this.repository.update(userId, id, dto);
    const contact = await this.repository.findById(userId, id);
    await this.activityService.log(
      userId,
      ActivityType.UPDATED,
      'Contact',
      `Updated contact ${contact?.firstName} ${contact?.lastName}`,
      id,
    );
    return contact;
  }

  async remove(userId: string, id: string) {
    const contact = await this.findOne(userId, id);
    await this.repository.delete(userId, id);
    await this.activityService.log(
      userId,
      ActivityType.DELETED,
      'Contact',
      `Deleted contact ${contact.firstName} ${contact.lastName}`,
      id,
    );
    return { success: true };
  }
}
