-- The automatic renewal went away in 20260826003000_remove_auto_renewal_traces,
-- and with it the two emails only it sent: the reminder before the charge and
-- the notice of a charge that failed. The seed adds and updates templates but
-- never deletes one, so a database seeded before that date still lists both
-- under Administracija > E-mail sabloni, although nothing can send them and
-- their copy describes a stored card that no longer exists. A payment that
-- fails at checkout has its own template, subscription_checkout_failed.
DELETE FROM "EmailTemplate"
WHERE "key" IN ('subscription_payment_failed', 'subscription_renewal_reminder');

-- The per-user switches for the same two events. The dashboard wrote the
-- reminder's row together with the rest of its "Subscription" group.
DELETE FROM "NotificationSetting"
WHERE "event" IN ('subscription_payment_failed', 'subscription_renewal_reminder');
