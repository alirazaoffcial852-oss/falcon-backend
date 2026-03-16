export class RedisService {
	private static instance: RedisService;

	private constructor() {}

	static getInstance(): RedisService {
		if (!RedisService.instance) {
			RedisService.instance = new RedisService();
		}
		return RedisService.instance;
	}

	async disconnect(): Promise<void> {
		// Optional: close Redis connection when implemented
	}
}
