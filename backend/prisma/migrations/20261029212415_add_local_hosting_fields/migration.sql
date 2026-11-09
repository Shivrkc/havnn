-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."DeploymentStatus" ADD VALUE 'STARTING';
ALTER TYPE "public"."DeploymentStatus" ADD VALUE 'RUNNING';
ALTER TYPE "public"."DeploymentStatus" ADD VALUE 'STOPPED';
ALTER TYPE "public"."DeploymentStatus" ADD VALUE 'CRASHED';

-- AlterTable
ALTER TABLE "public"."Deployment" ADD COLUMN     "containerId" TEXT,
ADD COLUMN     "hostPort" INTEGER,
ADD COLUMN     "internalPort" INTEGER DEFAULT 3000,
ADD COLUMN     "localUrl" TEXT;

-- AlterTable
ALTER TABLE "public"."OAuthExchange" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."OAuthState" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "liveDeploymentId" TEXT;
