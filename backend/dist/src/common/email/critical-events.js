"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRITICAL_EMAIL_EVENTS = void 0;
exports.CRITICAL_EMAIL_EVENTS = new Set([
    'verify_email_resend',
    'password_reset_request',
    'password_changed',
    'new_device_login',
    'two_factor_reset_by_password_reset',
    'account_blocked',
    'account_deletion_confirm',
    'booking_payment_instructions',
    'booking_payment_reminder_half',
    'booking_payment_reminder_final',
    'booking_payment_confirmed',
    'subscription_invoice',
    'subscription_pro_forma',
    'booking_confirmed_cash',
    'booking_cancelled',
    'booking_reminder_day_before',
    'admin_new_listing_to_review',
    'admin_proposed_category',
    'admin_listing_reported',
    'admin_listing_report_priority',
    'admin_payment_disputed',
    'admin_no_show_disputed',
    'admin_new_booking',
]);
//# sourceMappingURL=critical-events.js.map