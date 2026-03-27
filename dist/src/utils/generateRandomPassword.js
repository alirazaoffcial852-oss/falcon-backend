"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRandomNumericPassword = exports.generateRandomOtp = exports.generateRandomPassword = void 0;
const crypto_1 = __importDefault(require("crypto"));
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
const generateRandomPassword = (length = 8) => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%^&*()_+-=";
    let password = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = crypto_1.default.randomInt(0, chars.length);
        password += chars[randomIndex];
    }
    return password;
};
exports.generateRandomPassword = generateRandomPassword;
const generateRandomOtp = () => {
    const digits = "0123456789";
    let pin = "";
    for (let i = 0; i < 5; i++) {
        const randomIndex = crypto_1.default.randomInt(0, digits.length);
        pin += digits[randomIndex];
    }
    return pin;
};
exports.generateRandomOtp = generateRandomOtp;
/**
 * Generates a random numeric password with configurable min/max length.
 * Default range is 6 to 8 digits.
 */
const generateRandomNumericPassword = (minLength = 6, maxLength = 8) => {
    const digits = "0123456789";
    const length = crypto_1.default.randomInt(minLength, maxLength + 1);
    let password = "";
    for (let i = 0; i < length; i++) {
        password += digits[crypto_1.default.randomInt(0, digits.length)];
    }
    return password;
};
exports.generateRandomNumericPassword = generateRandomNumericPassword;
