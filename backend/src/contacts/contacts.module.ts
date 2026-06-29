import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { ContactsController } from './contacts.controller';
import { ContactsRepository, ContactsService } from './contacts.service';

@Module({
  imports: [ActivityModule],
  controllers: [ContactsController],
  providers: [ContactsRepository, ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
