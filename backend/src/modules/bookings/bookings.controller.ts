import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { CreateBookingRequestDto } from './dto/create-booking-request.dto';
import { CancelBookingDto, DisputeNoShowDto, RejectBookingDto } from './dto/booking-actions.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('bookings')
@Controller()
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post('listings/:id/bookings')
  create(@CurrentUser('id') guestId: string, @Param('id') listingId: string, @Body() dto: CreateBookingRequestDto) {
    return this.bookingsService.createRequest(guestId, listingId, dto);
  }

  @Get('bookings/mine')
  listMine(
    @CurrentUser('id') userId: string,
    @Query('role') role: 'guest' | 'owner' = 'guest',
    @Query('status') status?: BookingStatus,
  ) {
    return this.bookingsService.listMine(userId, role, status);
  }

  @Get('bookings/:id')
  getOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.bookingsService.getOne(userId, id);
  }

  @Get('bookings/:id/qr')
  getQr(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.bookingsService.getIpsQrImage(userId, id).then((dataUrl) => ({ dataUrl }));
  }

  @Post('bookings/:id/approve')
  approve(@CurrentUser('id') ownerId: string, @Param('id') id: string) {
    return this.bookingsService.approveRequest(ownerId, id);
  }

  @Post('bookings/:id/reject')
  reject(@CurrentUser('id') ownerId: string, @Param('id') id: string, @Body() dto: RejectBookingDto) {
    return this.bookingsService.rejectRequest(ownerId, id, dto);
  }

  @Post('bookings/:id/confirm-payment')
  confirmPayment(@CurrentUser('id') ownerId: string, @Param('id') id: string) {
    return this.bookingsService.confirmPayment(ownerId, id);
  }

  @Post('bookings/:id/no-show')
  markNoShow(@CurrentUser('id') ownerId: string, @Param('id') id: string) {
    return this.bookingsService.markNoShow(ownerId, id);
  }

  @Post('bookings/:id/cancel-by-owner')
  cancelByOwner(@CurrentUser('id') ownerId: string, @Param('id') id: string, @Body() dto: CancelBookingDto) {
    return this.bookingsService.cancelByOwner(ownerId, id, dto);
  }

  @Post('bookings/:id/cancel')
  cancelByGuest(@CurrentUser('id') guestId: string, @Param('id') id: string, @Body() dto: CancelBookingDto) {
    return this.bookingsService.cancelByGuest(guestId, id, dto);
  }

  @Post('bookings/:id/dispute-no-show')
  disputeNoShow(@CurrentUser('id') guestId: string, @Param('id') id: string, @Body() dto: DisputeNoShowDto) {
    return this.bookingsService.disputeNoShow(guestId, id, dto);
  }

  @Post('bookings/:id/dispute-payment')
  disputePayment(@CurrentUser('id') guestId: string, @Param('id') id: string) {
    return this.bookingsService.disputeUnconfirmedPayment(guestId, id);
  }
}
