import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { DigestService } from './digest.service';

@Injectable()
export class DigestScheduler implements OnModuleInit {
  private readonly logger = new Logger(DigestScheduler.name);

  constructor(
    private readonly digestService: DigestService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const tz = this.digestService.getTimezone();
    const job = new CronJob(
      '0 9 * * *',
      () => {
        void this.handleDailyDigest();
      },
      null,
      true,
      tz,
    );

    this.schedulerRegistry.addCronJob('daily-digest', job);
    this.logger.log(`Daily Digest scheduler initialized (timezone=${tz})`);
  }

  async handleDailyDigest() {
    this.logger.log('Daily Digest started');
    try {
      const sent = await this.digestService.sendAllDigests();
      this.logger.log(`Daily Digest finished (sent=${sent})`);
    } catch (err) {
      this.logger.error(`Daily Digest finished with error: ${String(err)}`);
    }
  }
}
