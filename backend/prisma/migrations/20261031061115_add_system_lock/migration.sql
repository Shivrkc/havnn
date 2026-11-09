-- CreateTable
CREATE TABLE "public"."SystemLock" (
    "key" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemLock_pkey" PRIMARY KEY ("key")
);
