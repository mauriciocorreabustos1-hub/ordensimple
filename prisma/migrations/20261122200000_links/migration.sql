-- OrdenSimple Links: solo crea tablas nuevas (no modifica ni borra nada existente).
-- Para revertir: DROP TABLE "link_event", "link_image", "link_page"; DROP TYPE "LinkEventKind";
-- CreateEnum
CREATE TYPE "LinkEventKind" AS ENUM ('VIEW', 'CLICK');

-- CreateTable
CREATE TABLE "link_page" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "oldSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "published" BOOLEAN NOT NULL DEFAULT false,
    "draft" JSONB NOT NULL,
    "live" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "link_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_image" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_event" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "kind" "LinkEventKind" NOT NULL,
    "blockId" TEXT,
    "visitor" TEXT NOT NULL,
    "source" TEXT,
    "device" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "link_page_businessId_key" ON "link_page"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "link_page_slug_key" ON "link_page"("slug");

-- CreateIndex
CREATE INDEX "link_image_pageId_idx" ON "link_image"("pageId");

-- CreateIndex
CREATE INDEX "link_event_pageId_createdAt_idx" ON "link_event"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "link_event_pageId_visitor_createdAt_idx" ON "link_event"("pageId", "visitor", "createdAt");

-- AddForeignKey
ALTER TABLE "link_page" ADD CONSTRAINT "link_page_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_image" ADD CONSTRAINT "link_image_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "link_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_event" ADD CONSTRAINT "link_event_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "link_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

