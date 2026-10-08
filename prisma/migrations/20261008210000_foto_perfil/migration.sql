-- CreateTable
CREATE TABLE "user_photo" (
    "userId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "type" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_photo_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "user_photo" ADD CONSTRAINT "user_photo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

