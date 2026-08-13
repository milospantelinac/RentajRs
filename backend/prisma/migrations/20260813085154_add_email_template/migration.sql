-- CreateTable
CREATE TABLE "EmailTemplate" (
    "key" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "subject" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "buttonLabel" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("key","language")
);
