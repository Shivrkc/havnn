-- CreateTable
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "stateHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthExchange" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "codeHash" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthExchange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_stateHash_key" ON "OAuthState"("stateHash");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthExchange_codeHash_key" ON "OAuthExchange"("codeHash");
