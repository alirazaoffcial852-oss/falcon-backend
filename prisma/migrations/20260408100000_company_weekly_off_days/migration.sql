CREATE TYPE "Weekday" AS ENUM (
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY'
);

ALTER TABLE "companies"
ADD COLUMN "weekly_off_days" "Weekday"[] DEFAULT ARRAY[]::"Weekday"[] NOT NULL;
