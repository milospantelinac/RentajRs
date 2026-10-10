-- T141: the template a listing's defined slots were last made from in step 3
-- ("Napravi termine"), shown again there so the next period only needs new
-- dates. Empty until the owner makes slots that way.
ALTER TABLE "Listing" ADD COLUMN "slotTemplate" JSONB;
