import { timingSafeEqual } from "node:crypto";
import { demoContacts } from "@/app/lib/demo-contacts";

type SendRequest = {
	contactIds?: unknown;
	subject?: unknown;
	body?: unknown;
	consentConfirmed?: unknown;
};

function matchesToken(provided: string, expected: string) {
	const providedBuffer = Buffer.from(provided);
	const expectedBuffer = Buffer.from(expected);
	return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
	const sendToken = process.env.CAMPAIGN_SEND_TOKEN;
	const providedToken = request.headers.get("x-campaign-token") || "";
	if (!sendToken || !matchesToken(providedToken, sendToken)) {
		return Response.json({ error: "Campaign sending is not authorized. Check the operator token." }, { status: 401 });
	}

	const apiKey = process.env.RESEND_API_KEY;
	const from = process.env.RESEND_FROM_EMAIL;
	if (!apiKey || !from) {
		return Response.json({ error: "Email delivery is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL." }, { status: 503 });
	}

	let payload: SendRequest;
	try {
		payload = await request.json();
	} catch {
		return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
	}

	if (payload.consentConfirmed !== true) {
		return Response.json({ error: "Confirm that every selected recipient consented to marketing email." }, { status: 400 });
	}
	if (
		!Array.isArray(payload.contactIds) || payload.contactIds.length === 0 || payload.contactIds.length > demoContacts.length ||
		!payload.contactIds.every((id) => typeof id === "string") ||
		typeof payload.subject !== "string" || !payload.subject.trim() || payload.subject.length > 160 ||
		typeof payload.body !== "string" || !payload.body.trim() || payload.body.length > 8000
	) {
		return Response.json({ error: "Select valid recipients and provide a subject and message." }, { status: 400 });
	}

	const contacts = [...new Set(payload.contactIds)]
		.map((id) => demoContacts.find((contact) => contact.id === id))
		.filter((contact) => contact !== undefined);
	if (contacts.length !== new Set(payload.contactIds).size) {
		return Response.json({ error: "One or more recipients are not in the CRM contact list." }, { status: 400 });
	}

	const subject = payload.subject as string;
	const body = payload.body as string;
	const results = await Promise.all(contacts.map(async (contact) => {
		const personalizedBody = body.replaceAll("{{first_name}}", contact.name.split(" ")[0]);
		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
			body: JSON.stringify({
				from,
				to: [contact.email],
				subject,
				text: `${personalizedBody}\n\nYou received this promotional email from Elestial CRM. Reply with unsubscribe to opt out.`,
				reply_to: process.env.RESEND_REPLY_TO_EMAIL || from,
			}),
		});
		return { email: contact.email, sent: response.ok };
	}));

	return Response.json({ sent: results.filter((result) => result.sent).length, failed: results.filter((result) => !result.sent).map((result) => result.email) });
}