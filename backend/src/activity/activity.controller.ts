import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActivityService } from './activity.service';

@ApiTags('Activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  async findAll(
    @CurrentUser() user: { id: string },
    @Query() query: PaginationDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.activityService.findAll(
      user.id,
      page,
      limit,
    );
    return paginate(data, total, page, limit);
  }

  @Get('recent')
  async findRecent(@CurrentUser() user: { id: string }) {
    return this.activityService.findRecent(user.id);
  }
}
