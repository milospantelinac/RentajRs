import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { BookingChangesService } from './booking-changes.service';
import { CreateBookingRequestDto } from './dto/create-booking-request.dto';
import { CancelBookingDto, DisputeNoShowDto, RejectBookingDto } from './dto/booking-actions.dto';
import { ChangeTermDto, RejectBookingChangeDto, RequestBookingChangeDto } from './dto/booking-change.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('bookings')
@Controller()
export class BookingsController {
  constructor(
    private bookingsService: BookingsService,
    private changes: BookingChangesService,
  ) {}

  @Post('listings/:id/bookings')
  create(@CurrentUser('id') guestId: string, @Param('id') listingId: string, @Body() dto: CreateBookingRequestDto) {
    return this.bookingsService.createRequest(guestId, listingId, dto);
  }

  // Dizajn 11 — the listing page's booking card prices a selection live, for a
  // visitor who hasn't signed in yet. The quote reads only the listing's own
  // pricing rules and returns no user data, so it is safe to leave public;
  // actually creating the booking above still requires an account.
  @Public()
  @Post('listings/:id/bookings/quote')
  quote(@Param('id') listingId: string, @Body() dto: CreateBookingRequestDto) {
    return this.bookingsService.quotePrice(listingId, dto);
  }

  @Get('bookings/mine')
  listMine(
    @CurrentUser('id') userId: string,
    @Query('role') role: 'guest' | 'owner' = 'guest',
    // Dizajn 34: an unknown ?status= used to reach Prisma and come back as a 500.
    @Query('status', new ParseEnumPipe(BookingStatus, { optional: true })) status?: BookingStatus,
  ) {
    return this.bookingsService.listMine(userId, role, status);
  }

  @Get('bookings/:id')
  getOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.bookingsService.getOne(userId, id);
  }

  // -- T136: moving a booking to another term ------------------------------

  /** The listing's terms for the guest's change screen, their own booking's term left free. */
  @Get('bookings/:id/change/availability')
  changeAvailability(@CurrentUser('id') guestId: string, @Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    const now = new Date();
    const fromDate = from ? new Date(from) : now;
    const toDate = to ? new Date(to) : new Date(now.getTime() + 90 * 86_400_000);
    return this.changes.getAvailability(guestId, id, fromDate, toDate);
  }

  @Post('bookings/:id/change/quote')
  changeQuote(@CurrentUser('id') guestId: string, @Param('id') id: string, @Body() dto: ChangeTermDto) {
    return this.changes.quote(guestId, id, dto);
  }

  @Post('bookings/:id/change')
  requestChange(@CurrentUser('id') guestId: string, @Param('id') id: string, @Body() dto: RequestBookingChangeDto) {
    return this.changes.request(guestId, id, dto);
  }

  @Post('bookings/:id/change/withdraw')
  withdrawChange(@CurrentUser('id') guestId: string, @Param('id') id: string) {
    return this.changes.withdraw(guestId, id);
  }

  @Post('bookings/:id/change/approve')
  approveChange(@CurrentUser('id') ownerId: string, @Param('id') id: string) {
    return this.changes.approve(ownerId, id);
  }

  @Post('bookings/:id/change/reject')
  rejectChange(@CurrentUser('id') ownerId: string, @Param('id') id: string, @Body() dto: RejectBookingChangeDto) {
    return this.changes.reject(ownerId, id, dto);
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
