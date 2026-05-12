/**
 * Diagnose why passenger push may not arrive while history exists.
 * Usage: pnpm exec ts-node scripts/diagnose-passenger-push.ts [passengerId]
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import {
	getFirebaseMessaging,
	getFirebaseInitError,
} from "../src/config/firebaseAdmin";

const prisma = new PrismaClient();

async function main() {
	const passengerIdArg = process.argv[2];
	const passengerId = passengerIdArg ? parseInt(passengerIdArg, 10) : NaN;

	console.log("--- Passenger push diagnostic ---\n");

	const fb = getFirebaseMessaging();
	console.log(
		`Firebase Admin messaging: ${fb ? "OK (initialized)" : "NOT AVAILABLE"}`,
	);
	if (!fb) {
		console.log(`Init error hint: ${getFirebaseInitError() ?? "(none)"}`);
	}

	if (!Number.isFinite(passengerId) || passengerId <= 0) {
		console.log(
			"\nUsage: pnpm exec ts-node scripts/diagnose-passenger-push.ts <passengerId>",
		);
		await prisma.$disconnect();
		return;
	}

	const passenger = await prisma.passenger.findUnique({
		where: { id: passengerId },
		select: {
			id: true,
			name: true,
			user_id: true,
			phone_no: true,
		},
	});

	if (!passenger) {
		console.log(`Passenger id=${passengerId} not found.`);
		await prisma.$disconnect();
		return;
	}

	console.log("\nPassenger row:", passenger);

	if (passenger.user_id == null) {
		console.log(
			"\n❌ ISSUE: passenger.user_id is NULL — sendToPassengerIds skips this passenger (no user to attach FCM tokens / history user).",
		);
		await prisma.$disconnect();
		return;
	}

	const tokens = await prisma.userDeviceToken.findMany({
		where: { user_id: passenger.user_id, is_active: true },
		select: {
			id: true,
			platform: true,
			is_active: true,
			device_token: true,
		},
	});

	console.log(
		`\nActive device tokens for user_id=${passenger.user_id}: ${tokens.length}`,
	);
	if (!tokens.length) {
		console.log(
			"\n❌ ISSUE: No active rows in user_device_tokens for this user — push returns sent=0 after history (if history path ran). Register via POST /f1/mobile/notifications/device/register while logged in as this passenger.",
		);
	} else {
		tokens.forEach((t, i) => {
			const preview = t.device_token.slice(0, 28) + "…";
			console.log(`  [${i}] id=${t.id} platform=${t.platform ?? "?"} token=${preview}`);
		});
	}

	const recentHistory = await prisma.notificationHistory.findMany({
		where: { user_id: passenger.user_id },
		orderBy: { created_at: "desc" },
		take: 3,
		select: { id: true, title: true, created_at: true },
	});
	console.log("\nLatest notification_histories:", recentHistory.length ? recentHistory : "(none)");

	await prisma.$disconnect();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
