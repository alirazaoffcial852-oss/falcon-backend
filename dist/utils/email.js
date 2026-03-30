"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCredentialEmail = sendCredentialEmail;
exports.sendForgotPasswordOtpEmail = sendForgotPasswordOtpEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const ResponseHandler_1 = require("./responses/ResponseHandler");
function getTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
        throw ResponseHandler_1.ResponseHandler.internal("SMTP configuration missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS");
    }
    return nodemailer_1.default.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
}
async function sendCredentialEmail(to, role, password) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    if (!from) {
        throw ResponseHandler_1.ResponseHandler.internal("SMTP sender missing. Set SMTP_FROM or SMTP_USER");
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
async function sendForgotPasswordOtpEmail(to, otp) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    if (!from) {
        throw ResponseHandler_1.ResponseHandler.internal("SMTP sender missing. Set SMTP_FROM or SMTP_USER");
    }
    const transporter = getTransporter();
    await transporter.sendMail({
        from,
        to,
        subject: "Falcon password reset OTP",
        text: `Your Falcon password reset OTP is ${otp}. This code will expire in 5 minutes.`,
        html: `
		<div style="font-family: Arial, sans-serif; line-height: 1.6;">
			<h3>Falcon password reset</h3>
			<p>Your OTP is: <strong style="font-size: 20px;">${otp}</strong></p>
			<p>This code will expire in 5 minutes.</p>
		</div>
	`,
    });
}
