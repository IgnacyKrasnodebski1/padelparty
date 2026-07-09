-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ManagerRole" AS ENUM ('owner', 'staff');

-- CreateEnum
CREATE TYPE "ClubStatus" AS ENUM ('invited', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('free', 'pro', 'club_plus');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending_payment', 'confirmed', 'completed', 'expired', 'cancelled_refunded', 'cancelled_no_refund', 'cancelled_by_club');

-- CreateEnum
CREATE TYPE "BookingKind" AS ENUM ('booking', 'manual_block');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('unassigned', 'active', 'revoked');

-- CreateEnum
CREATE TYPE "MembershipSource" AS ENUM ('card', 'booking', 'invite');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'left');

-- CreateEnum
CREATE TYPE "LeagueCycle" AS ENUM ('weekly', 'monthly', 'yearly', 'custom');

-- CreateEnum
CREATE TYPE "LeagueScore" AS ENUM ('points', 'wins');

-- CreateEnum
CREATE TYPE "LeagueStatus" AS ENUM ('active', 'paused', 'ended');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('active', 'closed');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('pending', 'granted');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🎾',
    "color" TEXT NOT NULL DEFAULT '#6C5CE7',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passHash" TEXT NOT NULL,
    "token" TEXT,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "passHash" TEXT,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "backupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inviteToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "ManagerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerMembership" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "role" "ManagerRole" NOT NULL DEFAULT 'owner',

    CONSTRAINT "ManagerMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "logoUrl" TEXT,
    "brandColor" TEXT NOT NULL DEFAULT '#6C5CE7',
    "status" "ClubStatus" NOT NULL DEFAULT 'invited',
    "commissionBps" INTEGER NOT NULL DEFAULT 700,
    "cancellationHours" INTEGER NOT NULL DEFAULT 24,
    "stripeAccountId" TEXT,
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "screenToken" TEXT NOT NULL,
    "planTier" "PlanTier" NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "indoor" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "courtId" TEXT,
    "dayFrom" INTEGER NOT NULL,
    "dayTo" INTEGER NOT NULL,
    "timeFrom" TEXT NOT NULL,
    "timeTo" TEXT NOT NULL,
    "slotMinutes" INTEGER NOT NULL DEFAULT 90,
    "priceGr" INTEGER NOT NULL,

    CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningHours" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openFrom" TEXT NOT NULL,
    "openTo" TEXT NOT NULL,

    CONSTRAINT "OpeningHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "playerId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "priceGr" INTEGER NOT NULL DEFAULT 0,
    "commissionGr" INTEGER NOT NULL DEFAULT 0,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending_payment',
    "kind" "BookingKind" NOT NULL DEFAULT 'booking',
    "paymentIntentId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "eventType" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "amountGr" INTEGER NOT NULL DEFAULT 0,
    "feeGr" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "stripePayoutId" TEXT NOT NULL,
    "amountGr" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "arrivalDate" TIMESTAMP(3),

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardBatch" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubCard" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "CardStatus" NOT NULL DEFAULT 'unassigned',
    "playerId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ClubCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubMembership" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "source" "MembershipSource" NOT NULL DEFAULT 'card',
    "status" "MembershipStatus" NOT NULL DEFAULT 'active',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cycle" "LeagueCycle" NOT NULL,
    "autoEnroll" BOOLEAN NOT NULL DEFAULT true,
    "scoring" "LeagueScore" NOT NULL DEFAULT 'points',
    "status" "LeagueStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'active',
    "winners" JSONB,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" TEXT NOT NULL,
    "aScore" INTEGER NOT NULL,
    "bScore" INTEGER NOT NULL,
    "partyId" TEXT,
    "tournamentId" TEXT,
    "clubId" TEXT,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePlayerA" (
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "GamePlayerA_pkey" PRIMARY KEY ("gameId","playerId")
);

-- CreateTable
CREATE TABLE "GamePlayerB" (
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "GamePlayerB_pkey" PRIMARY KEY ("gameId","playerId")
);

-- CreateTable
CREATE TABLE "PartyGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'americano',
    "memberIds" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "scoring" TEXT NOT NULL DEFAULT 'points',
    "pointsTarget" INTEGER NOT NULL DEFAULT 24,
    "weekly" BOOLEAN NOT NULL DEFAULT false,
    "rounds" INTEGER NOT NULL DEFAULT 0,
    "courts" INTEGER NOT NULL DEFAULT 1,
    "playerIds" TEXT[],
    "teams" JSONB,
    "matches" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'live',
    "clubId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "clubId" TEXT,
    "seasonId" TEXT,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sharedSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerPlayerId" TEXT NOT NULL,
    "referredPlayerId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'share',
    "rewardStatus" "RewardStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "priceGr" INTEGER,
    "promoted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTicket" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "EventTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_login_key" ON "Account"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Account_token_key" ON "Account"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Account_playerId_key" ON "Account"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerAccount_email_key" ON "ManagerAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerAccount_inviteToken_key" ON "ManagerAccount"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerMembership_managerId_clubId_key" ON "ManagerMembership"("managerId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Club_screenToken_key" ON "Club"("screenToken");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningHours_clubId_dayOfWeek_key" ON "OpeningHours"("clubId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_paymentIntentId_key" ON "Booking"("paymentIntentId");

-- CreateIndex
CREATE INDEX "Booking_clubId_startsAt_idx" ON "Booking"("clubId", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_playerId_startsAt_idx" ON "Booking"("playerId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_courtId_startsAt_key" ON "Booking"("courtId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_stripeEventId_key" ON "PaymentEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "PaymentEvent_bookingId_idx" ON "PaymentEvent"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_stripePayoutId_key" ON "Payout"("stripePayoutId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubCard_code_key" ON "ClubCard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ClubMembership_playerId_clubId_key" ON "ClubMembership"("playerId", "clubId");

-- CreateIndex
CREATE INDEX "Season_leagueId_status_idx" ON "Season"("leagueId", "status");

-- CreateIndex
CREATE INDEX "Game_clubId_ts_idx" ON "Game"("clubId", "ts");

-- CreateIndex
CREATE INDEX "Game_ts_idx" ON "Game"("ts");

-- CreateIndex
CREATE UNIQUE INDEX "PartyGroup_code_key" ON "PartyGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_sharedSlug_key" ON "Achievement"("sharedSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredPlayerId_key" ON "Referral"("referredPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "EventTicket_paymentIntentId_key" ON "EventTicket"("paymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "EventTicket_eventId_playerId_key" ON "EventTicket"("eventId", "playerId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerMembership" ADD CONSTRAINT "ManagerMembership_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "ManagerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerMembership" ADD CONSTRAINT "ManagerMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningHours" ADD CONSTRAINT "OpeningHours_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardBatch" ADD CONSTRAINT "CardBatch_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubCard" ADD CONSTRAINT "ClubCard_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubCard" ADD CONSTRAINT "ClubCard_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CardBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubCard" ADD CONSTRAINT "ClubCard_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayerA" ADD CONSTRAINT "GamePlayerA_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayerA" ADD CONSTRAINT "GamePlayerA_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayerB" ADD CONSTRAINT "GamePlayerB_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayerB" ADD CONSTRAINT "GamePlayerB_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerPlayerId_fkey" FOREIGN KEY ("referrerPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredPlayerId_fkey" FOREIGN KEY ("referredPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTicket" ADD CONSTRAINT "EventTicket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTicket" ADD CONSTRAINT "EventTicket_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

