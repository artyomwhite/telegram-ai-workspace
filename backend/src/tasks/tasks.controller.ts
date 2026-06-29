import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { paginate } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateTaskDto, TasksQueryDto, UpdateTaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user.id, dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: { id: string },
    @Query() query: TasksQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { data, total } = await this.tasksService.findAll(
      user.id,
      page,
      limit,
      query.search,
      { status: query.status, priority: query.priority },
    );
    return paginate(data, total, page, limit);
  }

  @Get(':id')
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.tasksService.findOne(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.tasksService.remove(user.id, id);
  }
}
