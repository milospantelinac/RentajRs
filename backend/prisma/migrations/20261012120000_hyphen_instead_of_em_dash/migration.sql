-- The site's own copy uses a plain hyphen where it had the em dash (U+2014,
-- written chr(8212) below): the email templates, the static pages, the FAQ,
-- the setting notes of Administracija > Podesavanja, the names of categories,
-- attributes and options (Translation, where the seed wrote "Bazen - spoljasnji"
-- and "Bazen - unutrasnji" with the em dash) and the booking models. Keys and
-- slugs stay as they are. What people wrote themselves (listings, messages,
-- reviews, reasons) and the AdminLog history are left alone, and so is
-- updatedAt, so the legal pages keep their "Poslednja izmena" date.

-- The bell first, while the templates still have the dash. A notification keeps
-- the heading and body text of its email with the listing title and the other
-- values people typed already filled in, so only the pieces of template copy
-- around a dash change ("recenziju - pomaze"), and only in the notifications of
-- that template. The pieces come from every version the seed ever had and from
-- the templates of this database, an admin's edit included.
DO $$
DECLARE
  dash CONSTANT text := chr(8212);
  piece record;
BEGIN
  FOR piece IN
    SELECT seeded.event, seeded.before || ' ' || dash || ' ' || seeded.after AS fragment
    FROM (VALUES
      ('account_deletion_confirm', 'ispod', 'link'),
      ('account_deletion_confirm', 'below', 'the'),
      ('admin_listing_report_priority', 'puta', 'dostignut'),
      ('admin_listing_report_priority', 'times', 'this'),
      ('booking_payment_instructions', 'rezervaciju', 'u'),
      ('booking_payment_instructions', 'booking', 'otherwise'),
      ('review_invitation', 'recenziju', 'pomaže'),
      ('review_invitation', 'review', 'it'),
      ('two_factor_reset_by_password_reset', 'isključena', 'tako'),
      ('two_factor_reset_by_password_reset', 'off', 'that''s')
    ) AS seeded(event, before, after)
    UNION
    SELECT t."key", m[1]
    FROM "EmailTemplate" t,
      regexp_matches(t."heading" || E'\n' || t."bodyText", '([^\s{}]+ ' || dash || ' [^\s{}]+)', 'g') AS m
  LOOP
    UPDATE "Notification"
    SET "title" = replace("title", piece.fragment, replace(piece.fragment, dash, '-')),
        "content" = replace("content", piece.fragment, replace(piece.fragment, dash, '-'))
    WHERE "event" = piece.event
      AND (strpos("title", piece.fragment) > 0 OR strpos("content", piece.fragment) > 0);
  END LOOP;
END $$;

UPDATE "EmailTemplate"
SET "subject" = replace("subject", chr(8212), '-'),
    "heading" = replace("heading", chr(8212), '-'),
    "bodyText" = replace("bodyText", chr(8212), '-'),
    "buttonLabel" = replace("buttonLabel", chr(8212), '-')
WHERE strpos("subject" || "heading" || "bodyText" || coalesce("buttonLabel", ''), chr(8212)) > 0;

UPDATE "StaticPage"
SET "title" = replace("title", chr(8212), '-'),
    "bodyHtml" = replace("bodyHtml", chr(8212), '-')
WHERE strpos("title" || "bodyHtml", chr(8212)) > 0;

UPDATE "Faq"
SET "question" = replace("question", chr(8212), '-'),
    "answer" = replace("answer", chr(8212), '-')
WHERE strpos("question" || "answer", chr(8212)) > 0;

UPDATE "Setting"
SET "description" = replace("description", chr(8212), '-')
WHERE strpos("description", chr(8212)) > 0;

UPDATE "Translation"
SET "value" = replace("value", chr(8212), '-')
WHERE strpos("value", chr(8212)) > 0;

UPDATE "BookingModelSetting"
SET "name" = replace("name", chr(8212), '-'),
    "description" = replace("description", chr(8212), '-')
WHERE strpos("name" || "description", chr(8212)) > 0;
