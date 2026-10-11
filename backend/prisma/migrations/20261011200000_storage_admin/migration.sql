-- T143: Administracija > Skladište. New tables only; nothing existing changes.

-- CreateEnum
CREATE TYPE "StorageScanStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "StorageItemReason" AS ENUM ('ORPHAN', 'DELETED_LISTING', 'DELETED_ACCOUNT');

-- CreateEnum
CREATE TYPE "StorageItemStatus" AS ENUM ('PENDING', 'DELETED', 'KEPT', 'SKIPPED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "StorageScan" (
    "id" UUID NOT NULL,
    "status" "StorageScanStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL,
    "triggeredById" UUID,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ,
    "error" TEXT,
    "usage" JSONB,
    "warning" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StorageScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageScanItem" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "reason" "StorageItemReason" NOT NULL,
    "files" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "lastModified" TIMESTAMPTZ NOT NULL,
    "sourceId" UUID,
    "dueAt" TIMESTAMPTZ,
    "context" JSONB,
    "status" "StorageItemStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" UUID,
    "decidedAt" TIMESTAMPTZ,
    "note" TEXT,

    CONSTRAINT "StorageScanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageHold" (
    "id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "reason" "StorageItemReason" NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorageScan_startedAt_idx" ON "StorageScan"("startedAt");

-- CreateIndex
CREATE INDEX "StorageScanItem_scanId_status_idx" ON "StorageScanItem"("scanId", "status");

-- CreateIndex
CREATE INDEX "StorageScanItem_status_idx" ON "StorageScanItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StorageHold_key_key" ON "StorageHold"("key");

-- AddForeignKey
ALTER TABLE "StorageScanItem" ADD CONSTRAINT "StorageScanItem_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "StorageScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Its own permission (deleting files cannot be undone), given to everyone who
-- can change the platform's settings today. prisma/seed.ts gives it to the
-- seeded admin of a new database.
INSERT INTO "Permission" ("id", "key", "description")
VALUES (gen_random_uuid(), 'manage_storage', 'Check storage, approve file deletions and set retention and upload limits')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "UserPermission" ("userId", "permissionId")
SELECT granted."userId", storage."id"
FROM "UserPermission" granted
JOIN "Permission" settings ON settings."id" = granted."permissionId" AND settings."key" = 'manage_settings'
CROSS JOIN "Permission" storage
WHERE storage."key" = 'manage_storage'
ON CONFLICT DO NOTHING;
