-- AlterEnum
-- T90 — a DISPUTED_NO_SHOW dispute needs an outcome that reverses the
-- booking's mark itself, distinct from the existing account-only outcomes
-- (WARNING/RESTRICTION/BLOCK/NO_ACTION).
ALTER TYPE "DisputeOutcome" ADD VALUE 'OVERTURN_NO_SHOW';
