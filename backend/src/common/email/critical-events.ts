/**
 * R90 — some notifications can never be opted out of: money, account
 * security, and confirmed-booking events. Every EmailTemplate.key NOT in
 * this set is a legitimate NotificationSetting.emailEnabled toggle (R87);
 * these always send regardless of what a NotificationSetting row says. Admin
 * operational emails are included too — for a single-admin account these
 * aren't a personal preference, they're how moderation work gets seen.
 */
export const CRITICAL_EMAIL_EVENTS = new Set<string>([
  // Security
  'verify_email_resend',
  'password_reset_request',
  'password_changed',
  'new_device_login',
  'two_factor_reset_by_password_reset',
  'account_blocked',
  'account_deletion_confirm',
  // Money
  'booking_payment_instructions',
  'booking_payment_reminder_half',
  'booking_payment_reminder_final',
  'booking_payment_confirmed',
  'subscription_invoice',
  'subscription_pro_forma',
  // Confirmed bookings
  'booking_confirmed_cash',
  'booking_cancelled',
  'booking_reminder_day_before',
  // Admin operational — not a personal preference
  'admin_new_listing_to_review',
  'admin_proposed_category',
  'admin_listing_reported',
  'admin_listing_report_priority',
  'admin_payment_disputed',
  'admin_no_show_disputed',
  'admin_new_booking',
]);
