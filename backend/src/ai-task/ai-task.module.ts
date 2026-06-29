import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiTaskController } from './ai-task.controller';
import { AiTaskService } from './ai-task.service';

@Module({
  imports: [PrismaModule],
  controllers: [AiTaskController],
  providers: [AiTaskService],
  exports: [AiTaskService],
})
export class AiTaskModule {}
