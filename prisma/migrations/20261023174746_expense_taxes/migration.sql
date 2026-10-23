-- AlterTable
ALTER TABLE "expense" ADD COLUMN     "specificTax" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "withholding" INTEGER NOT NULL DEFAULT 0;

