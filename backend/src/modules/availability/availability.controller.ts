import { Body, Controller, Delete, Get, Header, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import {
  SetWorkingHoursDto,
  CreateDefinedSlotDto,
  CreateManualBlockDto,
  SetDatePriceDto,
  SetHourlyPriceRangesDto,
  SetSlotPriceOverrideDto,
  AddIcalSourceDto,
} from './dto/availability.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('availability')
@Controller('listings/:id/availability')
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Public()
  @Get()
  getAvailability(@Param('id') id: string, @Query('from') from: string, @Query('to') to: string) {
    const now = new Date();
    const fromDate = from ? new Date(from) : now;
    const toDate = to ? new Date(to) : new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90);
    return this.availabilityService.getAvailability(id, fromDate, toDate);
  }

  @Post('working-hours')
  setWorkingHours(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: SetWorkingHoursDto) {
    return this.availabilityService.setWorkingHours(userId, id, dto);
  }

  @Get('pending-working-hours')
  getPendingWorkingHours(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.availabilityService.getPendingWorkingHours(userId, id);
  }

  @Post('slots')
  createSlot(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: CreateDefinedSlotDto) {
    return this.availabilityService.createDefinedSlot(userId, id, dto);
  }

  @Delete('slots/:slotId')
  deleteSlot(@CurrentUser('id') userId: string, @Param('id') id: string, @Param('slotId') slotId: string) {
    return this.availabilityService.deleteDefinedSlot(userId, id, slotId);
  }

  @Post('blocks')
  createBlock(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: CreateManualBlockDto) {
    return this.availabilityService.createManualBlock(userId, id, dto);
  }

  @Delete('blocks/:blockId')
  deleteBlock(@CurrentUser('id') userId: string, @Param('id') id: string, @Param('blockId') blockId: string) {
    return this.availabilityService.deleteManualBlock(userId, id, blockId);
  }

  @Post('date-price')
  setDatePrice(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: SetDatePriceDto) {
    return this.availabilityService.setDatePrice(userId, id, dto);
  }

  @Delete('date-price/:date')
  deleteDatePrice(@CurrentUser('id') userId: string, @Param('id') id: string, @Param('date') date: string) {
    return this.availabilityService.deleteDatePrice(userId, id, date);
  }

  @Post('hourly-price-ranges')
  setHourlyPriceRanges(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: SetHourlyPriceRangesDto,
  ) {
    return this.availabilityService.setHourlyPriceRanges(userId, id, dto);
  }

  @Post('slot-price-overrides')
  setSlotPriceOverride(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: SetSlotPriceOverrideDto,
  ) {
    return this.availabilityService.setSlotPriceOverride(userId, id, dto);
  }

  @Delete('slot-price-overrides/:overrideId')
  deleteSlotPriceOverride(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('overrideId') overrideId: string,
  ) {
    return this.availabilityService.deleteSlotPriceOverride(userId, id, overrideId);
  }

  @Get('ical-sources')
  listIcalSources(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.availabilityService.listIcalSources(userId, id);
  }

  @Post('ical-sources')
  addIcalSource(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: AddIcalSourceDto) {
    return this.availabilityService.addIcalSource(userId, id, dto);
  }

  @Delete('ical-sources/:sourceId')
  removeIcalSource(@CurrentUser('id') userId: string, @Param('id') id: string, @Param('sourceId') sourceId: string) {
    return this.availabilityService.removeIcalSource(userId, id, sourceId);
  }
}

@ApiTags('availability')
@Controller('ical')
export class IcalExportController {
  constructor(private availabilityService: AvailabilityService) {}

  @Public()
  @Get(':token.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  async export(@Param('token') token: string) {
    return this.availabilityService.exportIcs(token);
  }
}
