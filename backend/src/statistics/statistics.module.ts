import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { StatisticsController } from './statistics.controller';

@Module({
  imports: [ActivityModule],
  controllers: [StatisticsController],
})
export class StatisticsModule {}
