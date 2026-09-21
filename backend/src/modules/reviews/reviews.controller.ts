import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ReplyToReviewDto, UpdateReviewDto } from './dto/reviews.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post('reviews')
  create(@CurrentUser('id') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(userId, dto);
  }

  // Dizajn 39: the author's change, until the review is published (R96).
  @Patch('reviews/:id')
  update(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReviewDto) {
    return this.reviewsService.updateReview(userId, id, dto);
  }

  @Post('reviews/:id/reply')
  reply(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: ReplyToReviewDto) {
    return this.reviewsService.replyToReview(userId, id, dto);
  }

  @Public()
  @Get('listings/:id/reviews')
  getListingReviews(@Param('id') id: string) {
    return this.reviewsService.getListingReviews(id);
  }

  @Get('reviews/pending')
  getPending(@CurrentUser('id') userId: string) {
    return this.reviewsService.getMyPendingReviews(userId);
  }

  @Get('bookings/:id/reviews')
  getBookingReviewStatus(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.getBookingReviewStatus(userId, id);
  }

  @RequirePermissions('resolve_disputes')
  @Post('admin/reviews/:id/hide')
  adminHide(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.reviewsService.adminHideReview(adminId, id);
  }
}
