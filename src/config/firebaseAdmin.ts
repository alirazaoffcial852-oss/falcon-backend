import admin from "firebase-admin";

let initialized = false;
let initError: string | null = null;

function parseServiceAccountFromEnv() {
	const raw =
		process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
		process.env.FIREBASE_SERVICE_ACCOUNT;
	if (raw) {
		try {
			return JSON.parse(raw);
		} catch {
			// ignore; try other env formats
		}
	}

	const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
	if (b64) {
		try {
			return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
		} catch {
			// ignore
		}
	}

	return null;
}

export function initFirebaseAdmin(): void {
	if (initialized) return;
	const serviceAccount = parseServiceAccountFromEnv();
	if (!serviceAccount) {
		initError =
			"Firebase service account is missing or invalid. Set FIREBASE_SERVICE_ACCOUNT_JSON (recommended) or FIREBASE_SERVICE_ACCOUNT_BASE64.";
		return;
	}
	if (!admin.apps.length) {
		admin.initializeApp({
			credential: admin.credential.cert(serviceAccount),
		});
	}
	initialized = true;
	initError = null;
}

export function getFirebaseMessaging(): admin.messaging.Messaging | null {
	try {
		initFirebaseAdmin();
		if (!initialized) return null;
		return admin.messaging();
	} catch (error) {
		initError = "Firebase initialization failed";
		return null;
	}
}

export function getFirebaseInitError(): string | null {
	return initError;
}

