import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ActivityType } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  TelegramApiService,
  TelegramBotService,
  TelegramConnectionService,
} from './telegram.service';

@ApiTags('Telegram')
@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly botService: TelegramBotService,
    private readonly apiService: TelegramApiService,
    private readonly connectionService: TelegramConnectionService,
    private readonly activityService: ActivityService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  @SkipThrottle()
  async webhook(@Body() update: Record<string, unknown>) {
    await this.botService.handleUpdate(update);
    return { ok: true };
  }

  @Post('webhook/setup')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async setupWebhook() {
    return this.apiService.registerWebhookFromEnv();
  }

  @Get('webhook/info')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async webhookInfo() {
    return this.apiService.getWebhookInfo();
  }

  @Get('connection')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getConnection(@CurrentUser() user: { id: string }) {
    return this.connectionService.getConnection(user.id);
  }

  @Post('disconnect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async disconnect(@CurrentUser() user: { id: string }) {
    const result = await this.connectionService.disconnect(user.id);
    if (result) {
      await this.activityService.log(
        user.id,
        ActivityType.DISCONNECTED,
        'Telegram',
        'Telegram account disconnected',
      );
    }
    return { success: true };
  }
}
