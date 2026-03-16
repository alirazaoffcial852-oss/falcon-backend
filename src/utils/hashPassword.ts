import bcrypt from "bcryptjs";

/**
 * Hashes a password using bcrypt with a salt of 10 rounds
 * @param password - The plain text password to hash
 * @returns A Promise that resolves to the hashed password string
 * @throws Will throw an error if the hashing process fails
 */
export const hashPassword = async (password: string): Promise<string> => {
	const saltRounds = 10;
	return await bcrypt.hash(password, saltRounds);
};
