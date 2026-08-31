import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonEmailModule } from '../../common/email/email.module';
import { AccountEmailListener } from './listeners/account-email.listener';
import { ListingEmailListener } from './listeners/listing-email.listener';
import { BookingEmailListener } from './listeners/booking-email.listener';
import { ReviewEmailListener } from './listeners/review-email.listener';
import { SubscriptionEmailListener } from './listeners/subscription-email.listener';
import { AdminEmailListener } from './listeners/admin-email.listener';
import { DataProtectionEmailListener } from './listeners/data-protection-email.listener';
import { ContactEmailListener } from './listeners/contact-email.listener';
import { MessagingEmailListener } from './listeners/messaging-email.listener';

/**
 * Purely reactive — every provider here is an `@OnEvent` listener that turns
 * an existing domain event into one EmailService.send() call (Ch.22.4).
 * Listeners talk to PrismaService directly rather than injecting the
 * emitting feature's service, so this module never needs to import
 * BookingsModule/ListingsModule/etc. — same decoupling reason those modules
 * use EventEmitter2 instead of forwardRef() with each other.
 */
@Module({
  imports: [PrismaModule, CommonEmailModule],
  providers: [
    AccountEmailListener,
    ListingEmailListener,
    BookingEmailListener,
    ReviewEmailListener,
    SubscriptionEmailListener,
    AdminEmailListener,
    DataProtectionEmailListener,
    ContactEmailListener,
    MessagingEmailListener,
  ],
})
export class EmailModule {}
