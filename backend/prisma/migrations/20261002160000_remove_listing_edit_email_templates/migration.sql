-- Edits to a published listing apply at once since T84 (the decision of
-- 2026-08-27: administrators approve new listings only), so the two emails
-- about an edit being approved or rejected have had nothing to send them
-- since. They are gone from the seed; the seed never deletes a template, so
-- a database seeded before keeps both rows, listed under Administracija >
-- E-mail sabloni as if they were still in use.
DELETE FROM "EmailTemplate"
WHERE "key" IN ('listing_edit_approved', 'listing_edit_rejected');

-- The per-user switches the dashboard wrote for them together with the rest
-- of its "Listings" group.
DELETE FROM "NotificationSetting"
WHERE "event" IN ('listing_edit_approved', 'listing_edit_rejected');
