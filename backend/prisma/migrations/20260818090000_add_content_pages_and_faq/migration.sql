-- StaticPage was created but never wired up (no content columns, no
-- callers anywhere in the codebase) — safe to drop and recreate with the
-- shape it actually needs now instead of an additive ALTER.
DROP TABLE "StaticPage";

-- CreateTable
CREATE TABLE "StaticPage" (
    "slug" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "title" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "StaticPage_pkey" PRIMARY KEY ("slug","language")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" UUID NOT NULL,
    "language" "Language" NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Faq_language_published_displayOrder_idx" ON "Faq"("language", "published", "displayOrder");
