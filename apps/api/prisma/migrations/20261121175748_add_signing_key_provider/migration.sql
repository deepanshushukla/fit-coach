-- AlterTable
ALTER TABLE "SigningKey" ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'local',
ALTER COLUMN "privateKeyPem" DROP NOT NULL;
