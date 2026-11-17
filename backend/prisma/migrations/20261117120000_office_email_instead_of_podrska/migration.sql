-- The address people are told to write to is office@rentaj.rs, the inbox the
-- contact form, the terms and the privacy policy already name. The footer of
-- every e-mail and the contact line of the About page (O nama) still said
-- podrska@rentaj.rs. The footer comes from the code and the seed has the new
-- address now, but the seed only creates the pages and templates a database
-- lacks (an admin's edit in Sadrzaj and E-mail sabloni survives a reseed), so
-- the rows that exist keep the old address until this changes it.
--
-- Only the address is replaced: whatever else an admin wrote stays as it is,
-- and so does updatedAt. The AdminLog and EmailLog history are left alone.
UPDATE "StaticPage"
SET "bodyHtml" = replace("bodyHtml", 'podrska@rentaj.rs', 'office@rentaj.rs')
WHERE strpos("bodyHtml", 'podrska@rentaj.rs') > 0;

-- An admin can type the address into an e-mail template or an FAQ answer as
-- well, so those get the same exact replacement.
UPDATE "EmailTemplate"
SET "subject" = replace("subject", 'podrska@rentaj.rs', 'office@rentaj.rs'),
    "heading" = replace("heading", 'podrska@rentaj.rs', 'office@rentaj.rs'),
    "bodyText" = replace("bodyText", 'podrska@rentaj.rs', 'office@rentaj.rs'),
    "buttonLabel" = replace("buttonLabel", 'podrska@rentaj.rs', 'office@rentaj.rs')
WHERE strpos("subject", 'podrska@rentaj.rs') > 0
   OR strpos("heading", 'podrska@rentaj.rs') > 0
   OR strpos("bodyText", 'podrska@rentaj.rs') > 0
   OR strpos("buttonLabel", 'podrska@rentaj.rs') > 0;

UPDATE "Faq"
SET "question" = replace("question", 'podrska@rentaj.rs', 'office@rentaj.rs'),
    "answer" = replace("answer", 'podrska@rentaj.rs', 'office@rentaj.rs')
WHERE strpos("question", 'podrska@rentaj.rs') > 0
   OR strpos("answer", 'podrska@rentaj.rs') > 0;
