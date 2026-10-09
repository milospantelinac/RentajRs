-- T127: a playroom request also says how many adults come with the children.
-- The owner's information only: no limit and no effect on the price.
ALTER TABLE "Booking" ADD COLUMN "adultCount" INTEGER;
