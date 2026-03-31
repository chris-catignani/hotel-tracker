/*
  Warnings:

  - Made the column `short_name` on table `point_types` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "point_types" ALTER COLUMN "short_name" SET NOT NULL;
