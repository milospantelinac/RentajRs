-- Hand-written follow-up to the Prisma-generated schema. Adds what Prisma's
-- schema language cannot express: extensions, a GiST exclusion constraint,
-- trigram indexes for fuzzy matching, and the database-level business-rule
-- checks the Product Bible explicitly calls for in Ch.17 §16
-- ("Provere na nivou baze, ne samo u aplikaciji").

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- btree_gist lets a GiST index/exclusion constraint mix an equality column
-- (listingId, a plain uuid) with a range column (tstzrange) in the same index.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- pg_trgm powers fuzzy matching: category-duplicate suggestions (R5) and
-- "did you mean" / relaxed search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- No-double-booking: two BlockedTerm rows for the same listing can never
-- overlap in time, enforced by Postgres itself rather than trusting every
-- code path to re-check before insert. '[)' bounds (start inclusive, end
-- exclusive) so back-to-back bookings with zero gap are still allowed.
-- ---------------------------------------------------------------------------

ALTER TABLE "BlockedTerm"
  ADD CONSTRAINT "blocked_term_no_overlap"
  EXCLUDE USING gist (
    "listingId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  );

-- ---------------------------------------------------------------------------
-- Fuzzy-match / search indexes
-- ---------------------------------------------------------------------------

CREATE INDEX "translation_value_trgm_idx" ON "Translation" USING GIN ("value" gin_trgm_ops);
CREATE INDEX "listing_title_trgm_idx" ON "Listing" USING GIN ("title" gin_trgm_ops);

-- Hot path for the main search query: active, available listings filtered by
-- category + city, sorted/filtered by price.
CREATE INDEX "listing_active_search_idx" ON "Listing" ("categoryId", "cityId", "price")
  WHERE "status" = 'ACTIVE' AND "available" = true;

-- ---------------------------------------------------------------------------
-- R24 — category tree depth capped at 3
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_category_max_depth() RETURNS TRIGGER AS $$
DECLARE
  depth INTEGER := 1;
  current_parent UUID := NEW."parentId";
BEGIN
  WHILE current_parent IS NOT NULL LOOP
    depth := depth + 1;
    IF depth > 3 THEN
      RAISE EXCEPTION 'Category tree cannot exceed 3 levels (R24)';
    END IF;
    SELECT "parentId" INTO current_parent FROM "Category" WHERE "id" = current_parent;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "category_max_depth_trigger"
  BEFORE INSERT OR UPDATE OF "parentId" ON "Category"
  FOR EACH ROW EXECUTE FUNCTION enforce_category_max_depth();

-- ---------------------------------------------------------------------------
-- R26 — a category with listings can never be hard-deleted, only merged or
-- archived via the admin flow.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_delete_category_with_listings() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Listing" WHERE "categoryId" = OLD."id" AND "deletedAt" IS NULL) THEN
    RAISE EXCEPTION 'Category has listings and cannot be deleted; merge or archive it instead (R26)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "category_no_delete_with_listings_trigger"
  BEFORE DELETE ON "Category"
  FOR EACH ROW EXECUTE FUNCTION prevent_delete_category_with_listings();

-- ---------------------------------------------------------------------------
-- Photo (max 20) and FAQ (max 5) limits per listing, enforced regardless of
-- which code path inserts the row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_listing_photo_limit() RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM "ListingPhoto" WHERE "listingId" = NEW."listingId") >= 20 THEN
    RAISE EXCEPTION 'A listing can have at most 20 photos';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "listing_photo_limit_trigger"
  BEFORE INSERT ON "ListingPhoto"
  FOR EACH ROW EXECUTE FUNCTION enforce_listing_photo_limit();

CREATE OR REPLACE FUNCTION enforce_listing_faq_limit() RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM "ListingFaq" WHERE "listingId" = NEW."listingId") >= 5 THEN
    RAISE EXCEPTION 'A listing can have at most 5 FAQ entries';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "listing_faq_limit_trigger"
  BEFORE INSERT ON "ListingFaq"
  FOR EACH ROW EXECUTE FUNCTION enforce_listing_faq_limit();

-- ---------------------------------------------------------------------------
-- A subscription can never cover more listings than its package allows
-- (Standard/Basic = 1, Pro = 4).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_subscription_listing_limit() RETURNS TRIGGER AS $$
DECLARE
  listing_limit INTEGER;
  current_count INTEGER;
BEGIN
  IF NEW."subscriptionId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p."listingLimit" INTO listing_limit
  FROM "Subscription" s
  JOIN "Package" p ON p."id" = s."packageId"
  WHERE s."id" = NEW."subscriptionId";

  SELECT COUNT(*) INTO current_count
  FROM "Listing"
  WHERE "subscriptionId" = NEW."subscriptionId"
    AND "deletedAt" IS NULL
    AND "id" != NEW."id";

  IF current_count + 1 > listing_limit THEN
    RAISE EXCEPTION 'Subscription listing limit exceeded (R116)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "subscription_listing_limit_trigger"
  BEFORE INSERT OR UPDATE OF "subscriptionId" ON "Listing"
  FOR EACH ROW EXECUTE FUNCTION enforce_subscription_listing_limit();

-- ---------------------------------------------------------------------------
-- R16 — a user can never book their own listing.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_self_booking() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."guestId" = NEW."ownerId" THEN
    RAISE EXCEPTION 'A user cannot book their own listing (R16)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "booking_no_self_booking_trigger"
  BEFORE INSERT ON "Booking"
  FOR EACH ROW EXECUTE FUNCTION prevent_self_booking();

-- ---------------------------------------------------------------------------
-- R92 — a review may only be written for a COMPLETED booking.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_review_requires_completed_booking() RETURNS TRIGGER AS $$
DECLARE
  booking_status "BookingStatus";
BEGIN
  SELECT "status" INTO booking_status FROM "Booking" WHERE "id" = NEW."bookingId";
  IF booking_status IS DISTINCT FROM 'COMPLETED' THEN
    RAISE EXCEPTION 'A review can only be written for a COMPLETED booking (R92)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "review_requires_completed_booking_trigger"
  BEFORE INSERT ON "Review"
  FOR EACH ROW EXECUTE FUNCTION enforce_review_requires_completed_booking();

-- ---------------------------------------------------------------------------
-- R25 — a listing's price unit must be one of its category's allowed units.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_listing_price_unit_allowed() RETURNS TRIGGER AS $$
DECLARE
  allowed "PriceUnit"[];
BEGIN
  SELECT "allowedPriceUnits" INTO allowed FROM "Category" WHERE "id" = NEW."categoryId";
  IF NOT (NEW."priceUnit" = ANY(allowed)) THEN
    RAISE EXCEPTION 'Price unit is not allowed for this category (R25)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "listing_price_unit_allowed_trigger"
  BEFORE INSERT OR UPDATE OF "priceUnit", "categoryId" ON "Listing"
  FOR EACH ROW EXECUTE FUNCTION enforce_listing_price_unit_allowed();
