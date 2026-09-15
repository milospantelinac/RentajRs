import { Module } from '@nestjs/common';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TaxonomyModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
