import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { CompaniesController } from './companies.controller';
import { CompaniesRepository, CompaniesService } from './companies.service';

@Module({
  imports: [ActivityModule],
  controllers: [CompaniesController],
  providers: [CompaniesRepository, CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
