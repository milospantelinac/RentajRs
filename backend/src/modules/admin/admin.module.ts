import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { HomepageVideoController } from './homepage-video.controller';
import { HomepageVideoService } from './homepage-video.service';
import { UsersModule } from '../users/users.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [UsersModule, BookingsModule],
  controllers: [AdminController, HomepageVideoController],
  providers: [AdminService, HomepageVideoService],
  exports: [AdminService],
})
export class AdminModule {}
