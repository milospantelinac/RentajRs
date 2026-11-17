-- The data export email says "sa Rentaj.rs" where it said "sa Rentaja", the
-- same spelling as "od Rentaj.rs" everywhere else. The seed only creates the
-- templates a database lacks (an admin's edit in E-mail sabloni survives a
-- reseed), so the Serbian row that exists keeps the old wording until this
-- changes it. Only that one phrase is replaced: whatever else an admin wrote
-- stays as it is, and so does updatedAt.
UPDATE "EmailTemplate"
SET "bodyText" = replace("bodyText", 'podataka sa Rentaja,', 'podataka sa Rentaj.rs,')
WHERE "key" = 'data_export_ready'
  AND "language" = 'SR'
  AND strpos("bodyText", 'podataka sa Rentaja,') > 0;

-- The bell keeps the body text of the email it was made from. This template has
-- no values filled in, so the notifications it made carry the old phrase as it is.
UPDATE "Notification"
SET "content" = replace("content", 'podataka sa Rentaja,', 'podataka sa Rentaj.rs,')
WHERE "event" = 'data_export_ready'
  AND strpos("content", 'podataka sa Rentaja,') > 0;
