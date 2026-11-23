import { createHmac, timingSafeEqual } from "node:crypto";

export function createUnsubscribeToken(organizationId: string, email: string) {
	const secret = process.env.UNSUBSCRIBE_SECRET;
	if (!secret) throw new Error("Unsubscribe signing is not configured.");
	return createHmac("sha256", secret).update(`${organizationId}:${email.toLowerCase()}`).digest("hex");
}

export function verifyUnsubscribeToken(organizationId: string, email: string, token: string) {
	if (!process.env.UNSUBSCRIBE_SECRET || !/^[a-f0-9]{64}$/i.test(token)) return false;
	const expected = Buffer.from(createUnsubscribeToken(organizationId, email), "hex");
	const supplied = Buffer.from(token, "hex");
	return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
