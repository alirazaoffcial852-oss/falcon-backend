import fs from "fs";
import path from "path";
import admin from "firebase-admin";

let initialized = false;
let initError: string | null = null;

type ServiceAccountShape = {
	project_id?: string;
	client_email?: string;
	private_key?: string;
};

function looksLikePrivateKey(pk: string): boolean {
	const p = pk.trim();
	if (p.length < 80) return false;
	return (
		p.includes("BEGIN PRIVATE KEY") ||
		p.includes("BEGIN RSA PRIVATE KEY") ||
		p.includes("BEGIN EC PRIVATE KEY")
	);
}

function isValidServiceAccount(obj: unknown): obj is ServiceAccountShape {
	if (typeof obj !== "object" || obj === null) return false;
	const o = obj as Record<string, unknown>;
	return (
		typeof o.project_id === "string" &&
		o.project_id.length > 0 &&
		typeof o.client_email === "string" &&
		o.client_email.length > 0 &&
		typeof o.private_key === "string" &&
		looksLikePrivateKey(o.private_key)
	);
}

function parseJsonFromRaw(raw: string, label: string): ServiceAccountShape | null {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!isValidServiceAccount(parsed)) {
			initError = `${label}: JSON parsed but missing project_id, client_email, or private_key (expected PEM)`;
			return null;
		}
		return parsed;
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		initError = `${label}: invalid JSON (${msg})`;
		return null;
	}
}

function loadServiceAccountFromFilePath(
	filePath: string,
	label: string,
): ServiceAccountShape | null {
	const resolved = path.isAbsolute(filePath)
		? filePath
		: path.join(process.cwd(), filePath);
	try {
		const raw = fs.readFileSync(resolved, "utf8");
		return parseJsonFromRaw(raw, label);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		initError = `${label}: cannot read ${resolved} (${msg})`;
		return null;
	}
}

function parseServiceAccountFromEnv(): ServiceAccountShape | null {
	const failures: string[] = [];

	const tryJsonEnv = (): ServiceAccountShape | null => {
		initError = null;
		const raw =
			process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
			process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
		if (!raw) return null;
		const label =
			process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
				? "FIREBASE_SERVICE_ACCOUNT_JSON"
				: "FIREBASE_SERVICE_ACCOUNT";
		const account = parseJsonFromRaw(raw, label);
		if (account) return account;
		if (initError) failures.push(initError);
		/** dotenv loads only the first line unless the whole JSON is one quoted block — multiline `KEY={ ... }` becomes truncated → JSON.parse fails */
		const looksTruncated =
			!raw.includes('"private_key"') ||
			!raw.includes('"project_id"') ||
			raw.length < 400;
		if (looksTruncated && raw.trimStart().startsWith("{")) {
			failures.push(
				"Likely cause: multiline Firebase JSON in .env is truncated by dotenv. Fix: save JSON as `firebase-service-account.json` and set FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json (or use FIREBASE_SERVICE_ACCOUNT_BASE64). Remove broken FIREBASE_SERVICE_ACCOUNT from .env.",
			);
		}
		return null;
	};

	const tryB64 = (): ServiceAccountShape | null => {
		initError = null;
		const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
		if (!b64) return null;
		try {
			const decoded = Buffer.from(b64, "base64").toString("utf8");
			const account = parseJsonFromRaw(decoded, "FIREBASE_SERVICE_ACCOUNT_BASE64");
			if (account) return account;
			if (initError) failures.push(initError);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			failures.push(`FIREBASE_SERVICE_ACCOUNT_BASE64: decode failed (${msg})`);
		}
		return null;
	};

	const tryPath = (
		envValue: string | undefined,
		label: string,
	): ServiceAccountShape | null => {
		initError = null;
		const p = envValue?.trim();
		if (!p) return null;
		const account = loadServiceAccountFromFilePath(p, label);
		if (account) return account;
		if (initError) failures.push(initError);
		return null;
	};

	// Prefer file paths first: a stale shell `FIREBASE_SERVICE_ACCOUNT={` must not block a valid JSON file.
	// Order: explicit path → GOOGLE_APPLICATION_CREDENTIALS → base64 → inline JSON (often truncated in .env).
	const fromExplicitPath = tryPath(
		process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
		"FIREBASE_SERVICE_ACCOUNT_PATH",
	);
	if (fromExplicitPath) return fromExplicitPath;

	const fromGac = tryPath(
		process.env.GOOGLE_APPLICATION_CREDENTIALS,
		"GOOGLE_APPLICATION_CREDENTIALS",
	);
	if (fromGac) return fromGac;

	const fromB64 = tryB64();
	if (fromB64) return fromB64;

	const fromJson = tryJsonEnv();
	if (fromJson) return fromJson;

	initError =
		failures.length > 0
			? `Firebase credentials failed (${failures.join(" · ")})`
			: "No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS.";
	return null;
}

export function initFirebaseAdmin(): void {
	if (initialized) return;
	const serviceAccount = parseServiceAccountFromEnv();
	if (!serviceAccount) {
		if (!initError) {
			initError =
				"Firebase service account is missing or invalid. Set FIREBASE_SERVICE_ACCOUNT_JSON (recommended) or FIREBASE_SERVICE_ACCOUNT_BASE64.";
		}
		return;
	}
	try {
		if (!admin.apps.length) {
			admin.initializeApp({
				credential: admin.credential.cert(
					serviceAccount as admin.ServiceAccount,
				),
			});
		}
		initialized = true;
		initError = null;
	} catch (error) {
		initialized = false;
		const msg = error instanceof Error ? error.message : String(error);
		initError = `Firebase admin.initializeApp failed: ${msg}`;
	}
}

export function getFirebaseMessaging(): admin.messaging.Messaging | null {
	try {
		initFirebaseAdmin();
		if (!initialized) return null;
		return admin.messaging();
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		initError = `Firebase messaging: ${msg}`;
		return null;
	}
}

export function getFirebaseInitError(): string | null {
	return initError;
}

/** True when FCM can send (credentials loaded and admin initialized). */
export function isFirebaseMessagingReady(): boolean {
	initFirebaseAdmin();
	return initialized;
}
