import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DigestTelegramSender {
  private readonly logger = new Logger(DigestTelegramSender.name);
  private readonly baseUrl: string | null;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('telegram.botToken');
    this.baseUrl = token ? `https://api.telegram.org/bot${token}` : null;
  }

  async send(chatId: string, text: string): Promise<boolean> {
    if (!this.baseUrl) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not configured — digest skipped');
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Digest Telegram API error (chatId=${chatId}): ${error}`);
        return false;
      }

      return true;
    } catch (err) {
      this.logger.error(
        `Digest Telegram send failed (chatId=${chatId}): ${String(err)}`,
      );
      return false;
    }
  }
}
