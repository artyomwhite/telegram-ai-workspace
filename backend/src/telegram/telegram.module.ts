import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityModule } from '../activity/activity.module';
import { CompaniesModule } from '../companies/companies.module';
import { ContactsModule } from '../contacts/contacts.module';
import { RemindersModule } from '../reminders/reminders.module';
import { TasksModule } from '../tasks/tasks.module';
import { TelegramController } from './telegram.controller';
import {
  TelegramApiService,
  TelegramBotService,
  TelegramConnectionService,
} from './telegram.service';

@Module({
  imports: [
    ActivityModule,
    TasksModule,
    ContactsModule,
    CompaniesModule,
    RemindersModule,
  ],
  controllers: [TelegramController],
  providers: [
    TelegramApiService,
    TelegramBotService,
    TelegramConnectionService,
  ],
  exports: [TelegramApiService, TelegramBotService],
})
export class TelegramModule implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly telegramApi: TelegramApiService,
  ) {}

  async onModuleInit() {
    const webhookUrl = this.configService.get<string>('telegram.webhookUrl');
    const botToken = this.configService.get<string>('telegram.botToken');

    if (webhookUrl && botToken && process.env.NODE_ENV === 'production') {
      await this.telegramApi.setWebhook(`${webhookUrl}/telegram/webhook`);
    }
  }
}
