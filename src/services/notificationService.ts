import { Prisma } from "../generated/prisma/client";
import { DatabaseService } from "../config/database";
import { getFirebaseMessaging } from "../config/firebaseAdmin";

type NotificationPayload = {
	title: string;
	body: string;
	data?: Record<string, string>;
};

export class NotificationService {
	private db = DatabaseService.getInstance().getPrisma();

	async registerDeviceToken(
		userId: number,
		deviceToken: string,
		platform?: string,
	) {
		const token = deviceToken.trim();
		await this.db.userDeviceToken.upsert({
			where: { device_token: token },
			create: {
				user_id: userId,
				device_token: token,
				platform: platform?.trim() || null,
				is_active: true,
			},
			update: {
				user_id: userId,
				platform: platform?.trim() || null,
				is_active: true,
			},
		});
		return { deviceToken: token, isActive: true };
	}

	async unregisterDeviceToken(userId: number, deviceToken: string) {
		const token = deviceToken.trim();
		await this.db.userDeviceToken.updateMany({
			where: { user_id: userId, device_token: token },
			data: { is_active: false },
		});
		return { deviceToken: token, isActive: false };
	}

	async sendToUsers(userIds: number[], payload: NotificationPayload) {
		if (!userIds.length) return { sent: 0 };
		await this.createHistoryForUsers(userIds, payload);
		const tokens = await this.db.userDeviceToken.findMany({
			where: {
				user_id: { in: userIds },
				is_active: true,
			},
			select: { id: true, device_token: true },
		});
		const uniqueTokens = Array.from(
			new Set(tokens.map((t) => t.device_token).filter(Boolean)),
		);
		if (!uniqueTokens.length) return { sent: 0 };

		const messaging = getFirebaseMessaging();
		if (!messaging) return { sent: 0 };

		const response = await messaging.sendEachForMulticast({
			tokens: uniqueTokens,
			notification: {
				title: payload.title,
				body: payload.body,
			},
			data: payload.data ?? {},
		});

		// Deactivate invalid tokens to keep table clean
		const invalidIndexes: number[] = [];
		response.responses.forEach((r, idx) => {
			if (!r.success) {
				const code = r.error?.code ?? "";
				if (
					code.includes("registration-token-not-registered") ||
					code.includes("invalid-registration-token")
				) {
					invalidIndexes.push(idx);
				}
			}
		});

		if (invalidIndexes.length > 0) {
			const invalidTokens = invalidIndexes.map((i) => uniqueTokens[i]);
			await this.db.userDeviceToken.updateMany({
				where: { device_token: { in: invalidTokens } },
				data: { is_active: false },
			});
		}

		return { sent: response.successCount, failed: response.failureCount };
	}

	private async createHistoryForUsers(
		userIds: number[],
		payload: NotificationPayload,
	) {
		if (!userIds.length) return;
		const uniqueUserIds = Array.from(new Set(userIds));
		await this.db.notificationHistory.createMany({
			data: uniqueUserIds.map((userId) => ({
				user_id: userId,
				title: payload.title,
				body: payload.body,
				...(payload.data && {
					data: payload.data as Prisma.InputJsonValue,
				}),
			})),
		});
	}

	async sendToPassengerIds(
		passengerIds: number[],
		payload: NotificationPayload,
	): Promise<{ sent: number; failed?: number }> {
		if (!passengerIds.length) return { sent: 0 };
		const passengers = await this.db.passenger.findMany({
			where: { id: { in: passengerIds } },
			select: { user_id: true },
		});
		const userIds = passengers
			.map((p) => p.user_id)
			.filter((id): id is number => id !== null);
		return this.sendToUsers(userIds, payload);
	}

	async sendToDriverId(
		driverId: number,
		payload: NotificationPayload,
	): Promise<{ sent: number; failed?: number }> {
		const driver = await this.db.driver.findUnique({
			where: { id: driverId },
			select: { user_id: true },
		});
		if (!driver?.user_id) return { sent: 0 };
		return this.sendToUsers([driver.user_id], payload);
	}

	async getHistory(userId: number, page = 1, limit = 20) {
		const take = Math.max(1, Math.min(100, limit));
		const skip = (Math.max(1, page) - 1) * take;
		const [total, rows] = await Promise.all([
			this.db.notificationHistory.count({ where: { user_id: userId } }),
			this.db.notificationHistory.findMany({
				where: { user_id: userId },
				orderBy: { created_at: "desc" },
				skip,
				take,
			}),
		]);
		return {
			data: rows,
			pagination: {
				total,
				page: Math.max(1, page),
				limit: take,
				total_pages: Math.ceil(total / take),
			},
		};
	}

	async markAsRead(userId: number, notificationId: number) {
		const existing = await this.db.notificationHistory.findFirst({
			where: { id: notificationId, user_id: userId },
			select: { id: true },
		});
		if (!existing) return null;
		return this.db.notificationHistory.update({
			where: { id: notificationId },
			data: { is_read: true, read_at: new Date() },
		});
	}
}

export const notificationService = new NotificationService();

