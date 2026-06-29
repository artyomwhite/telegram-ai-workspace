import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AiTaskService } from './ai-task.service';

class ParseTaskDto {
  @IsString()
  @MinLength(1)
  input!: string;
}

@ApiTags('AI Task')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-task')
export class AiTaskController {
  constructor(private readonly aiTaskService: AiTaskService) {}

  @Post('parse')
  parse(@CurrentUser() user: { id: string }, @Body() dto: ParseTaskDto) {
    const parsed = this.aiTaskService.parse(dto.input);
    void this.aiTaskService.logAiRequest(
      user.id,
      dto.input,
      JSON.stringify(parsed),
    );
    return {
      ...parsed,
      createPayload: this.aiTaskService.toCreatePayload(parsed),
    };
  }
}
