-- Dizajn 39: a guest may cancel a confirmed cash booking while its free
-- cancellation lasts, so the booking keeps its policy as data next to the
-- frozen text (cancellationTermsSnapshot).

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "cancellationPolicyType" "CancellationPolicyType";
ALTER TABLE "Booking" ADD COLUMN "cancellationThreshold" INTEGER;

-- Earlier bookings: read the policy back from the text formatCancellationPolicy
-- wrote (both languages). Any other text predates the numeric policy and stays
-- without one, which leaves such a booking as it was.
UPDATE "Booking" SET "cancellationPolicyType" = 'NO_CANCELLATION'
WHERE "cancellationTermsSnapshot" IN ('Bez otkazivanja', 'No cancellation');

UPDATE "Booking"
SET "cancellationPolicyType" = 'FREE_UNTIL_DAYS',
    "cancellationThreshold" = substring("cancellationTermsSnapshot" from '([0-9]+)')::INTEGER
WHERE "cancellationTermsSnapshot" ~ '^(Besplatno otkazivanje do [0-9]+ dana pre početka|Free cancellation up to [0-9]+ day\(s\) before)$';

UPDATE "Booking"
SET "cancellationPolicyType" = 'FREE_UNTIL_HOURS',
    "cancellationThreshold" = substring("cancellationTermsSnapshot" from '([0-9]+)')::INTEGER
WHERE "cancellationTermsSnapshot" ~ '^(Besplatno otkazivanje do [0-9]+ časova pre početka|Free cancellation up to [0-9]+ hour\(s\) before)$';
