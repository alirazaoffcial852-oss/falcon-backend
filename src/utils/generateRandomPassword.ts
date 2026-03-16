import crypto from "crypto";

/**
 * Generates a random password string of specified length
 * @param length - The length of the password to generate (defaults to 8)
 * @returns A random string containing letters (upper and lowercase), numbers and special characters
 * @example
 * ```typescript
 * const password = generateRandomPassword(10); // Returns random 10 character password
 * const defaultPassword = generateRandomPassword(); // Returns random 8 character password
 * ```
 */
export const generateRandomPassword = (length: number = 8): string => {
	const chars =
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%^&*()_+-=";
	let password = "";
	for (let i = 0; i < length; i++) {
		const randomIndex = crypto.randomInt(0, chars.length);
		password += chars[randomIndex];
	}
	return password;
};

export const generateRandomOtp = (): string => {
	const digits = "0123456789";
	let pin = "";
	for (let i = 0; i < 5; i++) {
		const randomIndex = crypto.randomInt(0, digits.length);
		pin += digits[randomIndex];
	}
	return pin;
};
