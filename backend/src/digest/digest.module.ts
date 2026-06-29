import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DigestScheduler } from './digest.scheduler';
import { DigestService } from './digest.service';
import { DigestTelegramSender } from './digest-telegram.sender';

@Module({
  imports: [PrismaModule],
  providers: [DigestService, DigestScheduler, DigestTelegramSender],
  exports: [DigestService],
})
export class DigestModule {}
