import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { MANAGE_FREE_LISTINGS } from '../../common/utils/listing-access';
import { AdminListingsService } from './admin-listings.service';
import {
  AdminListingsQueryDto,
  ChangePeriodDto,
  CreateAdminListingDto,
  OwnerSearchQueryDto,
  PublishFreeListingDto,
} from './dto/admin-listings.dto';

/** Administracija > Oglasi: every listing, listings added for users without payment, and how long they last. */
@ApiTags('admin-listings')
@RequirePermissions(MANAGE_FREE_LISTINGS)
@Controller('admin/listings')
export class AdminListingsController {
  constructor(private adminListings: AdminListingsService) {}

  @Get()
  list(@Query() query: AdminListingsQueryDto) {
    return this.adminListings.list(query);
  }

  @Get('owners')
  owners(@Query() query: OwnerSearchQueryDto) {
    return this.adminListings.searchOwners(query);
  }

  @Get('owners/:id')
  owner(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminListings.getOwner(id);
  }

  @Post()
  create(@CurrentUser('id') adminId: string, @Body() dto: CreateAdminListingDto) {
    return this.adminListings.createForOwner(adminId, dto);
  }

  @Post(':id/publish')
  publish(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishFreeListingDto) {
    return this.adminListings.publish(adminId, id, dto);
  }

  @Get(':id/period')
  period(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminListings.getPeriod(id);
  }

  @Post(':id/period')
  changePeriod(@CurrentUser('id') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangePeriodDto) {
    return this.adminListings.changePeriod(adminId, id, dto);
  }
}
