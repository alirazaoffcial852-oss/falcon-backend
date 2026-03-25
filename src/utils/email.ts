import nodemailer from "nodemailer";
import { ResponseHandler } from "./responses/ResponseHandler";

function getTransporter() {
	const host = process.env.SMTP_HOST;
	const port = Number(process.env.SMTP_PORT || 587);
	const user = process.env.SMTP_USER;
	const pass = process.env.SMTP_PASS;

	if (!host || !user || !pass) {
		throw ResponseHandler.internal(
			"SMTP configuration missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS",
		);
	}

	return nodemailer.createTransport({
		host,
		port,
		secure: port === 465,
		auth: { user, pass },
	});
}

export async function sendCredentialEmail(
	to: string,
	role: "admin" | "driver" | "passenger",
	password: string,
) {
	const from = process.env.SMTP_FROM || process.env.SMTP_USER;
	if (!from) {
		throw ResponseHandler.internal(
			"SMTP sender missing. Set SMTP_FROM or SMTP_USER",
		);
	}

	const transporter = getTransporter();
	await transporter.sendMail({
		from,
		to,
		subject: `Falcon ${role} account credentials`,
		text: `Your Falcon ${role} account is created.\nEmail: ${to}\nTemporary Password: ${password}\nPlease login and change your password.`,
		html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h3>Falcon ${role} account created</h3>
        <p><strong>Email:</strong> ${to}</p>
        <p><strong>Temporary Password:</strong> ${password}</p>
        <p>Please login and change your password.</p>
      </div>
    `,
	});
}
