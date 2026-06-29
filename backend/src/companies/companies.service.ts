import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

@Injectable()
export class CompaniesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, data: CreateCompanyDto) {
    return this.prisma.company.create({ data: { ...data, userId } });
  }

  findMany(userId: string, skip: number, take: number, search?: string) {
    const where: Prisma.CompanyWhereInput = {
      userId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { industry: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return Promise.all([
      this.prisma.company.findMany({
        where,
        include: { _count: { select: { contacts: true, tasks: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.company.count({ where }),
    ]);
  }

  findById(userId: string, id: string) {
    return this.prisma.company.findFirst({
      where: { id, userId },
      include: {
        contacts: true,
        _count: { select: { tasks: true } },
      },
    });
  }

  update(userId: string, id: string, data: UpdateCompanyDto) {
    return this.prisma.company.updateMany({ where: { id, userId }, data });
  }

  delete(userId: string, id: string) {
    return this.prisma.company.deleteMany({ where: { id, userId } });
  }
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly repository: CompaniesRepository,
    private readonly activityService: ActivityService,
  ) {}

  async create(userId: string, dto: CreateCompanyDto) {
    const company = await this.repository.create(userId, dto);
    await this.activityService.log(
      userId,
      ActivityType.CREATED,
      'Company',
      `Created company ${company.name}`,
      company.id,
    );
    return company;
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
    const company = await this.repository.findById(userId, id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async update(userId: string, id: string, dto: UpdateCompanyDto) {
    await this.findOne(userId, id);
    await this.repository.update(userId, id, dto);
    const company = await this.repository.findById(userId, id);
    await this.activityService.log(
      userId,
      ActivityType.UPDATED,
      'Company',
      `Updated company ${company?.name}`,
      id,
    );
    return company;
  }

  async remove(userId: string, id: string) {
    const company = await this.findOne(userId, id);
    await this.repository.delete(userId, id);
    await this.activityService.log(
      userId,
      ActivityType.DELETED,
      'Company',
      `Deleted company ${company.name}`,
      id,
    );
    return { success: true };
  }
}
