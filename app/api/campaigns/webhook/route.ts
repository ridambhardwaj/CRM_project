import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseAdminConfig, supabaseAdminFetch } from "@/app/lib/supabase-admin";

type ResendWebhook = {
	type?: string;
	created_at?: string;
	data?: { email_id?: string; to?: string[]; created_at?: string; click?: { link?: string }; bounce?: { type?: string } };
};
type RecipientRow = { id: string; organization_id: string; campaign_id: string; client_id: string | null; email: string };

function verifySignature(request: Request, rawBody: string, secret: string) {
	const id = request.headers.get("svix-id") || "";
	const timestamp = request.headers.get("svix-timestamp") || "";
	const signatures = request.headers.get("svix-signature") || "";
	if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp)) return false;
	if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
	const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
	const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
	return signatures.split(" ").some((entry) => {
		const [version, encoded] = entry.split(",", 2);
		if (version !== "v1" || !encoded) return false;
		const received = Buffer.from(encoded, "base64");
		return received.length === expected.length && timingSafeEqual(received, expected);
	});
}

function normalizedType(type: string) {
	if (type === "email.sent") return "sent";
	if (type === "email.delivered") return "delivered";
	if (type === "email.bounced") return "bounced";
	if (type === "email.complained") return "complained";
	if (type === "email.opened") return "opened";
	if (type === "email.clicked") return "clicked";
	if (type === "email.unsubscribed") return "unsubscribed";
	return null;
}

export async function POST(request: Request) {
	const signingSecret = process.env.RESEND_WEBHOOK_SECRET;
	const config = getSupabaseAdminConfig();
	if (!signingSecret || !config) return Response.json({ error: "Provider webhook is not configured." }, { status: 503 });
	const rawBody = await request.text();
	if (!verifySignature(request, rawBody, signingSecret)) return Response.json({ error: "Invalid webhook signature." }, { status: 401 });

	let payload: ResendWebhook;
	try { payload = JSON.parse(rawBody) as ResendWebhook; } catch { return Response.json({ error: "Invalid webhook JSON." }, { status: 400 }); }
	const eventType = typeof payload.type === "string" ? normalizedType(payload.type) : null;
	const providerEventId = request.headers.get("svix-id") || "";
	const emailId = payload.data?.email_id;
	if (!eventType || !providerEventId || !emailId) return Response.json({ received: true, ignored: true });

	const recipientQuery = new URLSearchParams({ select: "id,organization_id,campaign_id,client_id,email", organization_id: `eq.${config.organizationId}`, provider_message_id: `eq.${emailId}`, limit: "1" });
	const recipientResponse = await supabaseAdminFetch(`email_campaign_recipients?${recipientQuery}`);
	if (!recipientResponse.ok) return Response.json({ error: "Could not match provider event to a campaign recipient." }, { status: 502 });
	const recipient = (await recipientResponse.json() as RecipientRow[])[0];
	if (!recipient) return Response.json({ received: true, unmatched: true });

	const occurredAt = payload.data?.created_at || payload.created_at || new Date().toISOString();
	const eventResponse = await supabaseAdminFetch("email_campaign_events?on_conflict=provider,provider_event_id", {
		method: "POST",
		headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
		body: JSON.stringify({
			organization_id: recipient.organization_id, campaign_id: recipient.campaign_id, recipient_id: recipient.id,
			provider: "resend", provider_event_id: providerEventId, event_type: eventType, is_verified: true,
			occurred_at: occurredAt,
			metadata: eventType === "clicked" ? { link: payload.data?.click?.link || "" } : {},
		}),
	});
	if (!eventResponse.ok) return Response.json({ error: "Could not record provider analytics." }, { status: 502 });

	if (["delivered", "bounced", "unsubscribed"].includes(eventType)) {
		const status = eventType === "delivered" ? "delivered" : eventType === "unsubscribed" ? "unsubscribed" : "bounced";
		const recipientUpdate = await supabaseAdminFetch(`email_campaign_recipients?id=eq.${recipient.id}&organization_id=eq.${recipient.organization_id}`, {
			method: "PATCH", headers: { Prefer: "return=minimal" },
			body: JSON.stringify({ status, delivered_at: eventType === "delivered" ? occurredAt : null }),
		});
		if (!recipientUpdate.ok) return Response.json({ error: "Could not update recipient delivery status." }, { status: 502 });
	}

	const permanentBounce = eventType === "bounced" && payload.data?.bounce?.type?.toLowerCase() === "permanent";
	if (eventType === "complained" || eventType === "unsubscribed" || permanentBounce) {
		const email = recipient.email.toLowerCase();
		const suppressionQuery = new URLSearchParams({ on_conflict: "organization_id,email" });
		const suppressionWrite = await supabaseAdminFetch(`email_suppressions?${suppressionQuery}`, {
			method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
			body: JSON.stringify({ organization_id: recipient.organization_id, email, reason: eventType === "complained" ? "complaint" : eventType === "unsubscribed" ? "unsubscribe" : "hard_bounce", source: "resend_webhook" }),
		});
		if (!suppressionWrite.ok) return Response.json({ error: "Could not persist recipient suppression." }, { status: 502 });
		if (eventType === "complained" || eventType === "unsubscribed") {
			const consentQuery = new URLSearchParams({ organization_id: `eq.${recipient.organization_id}`, email: `eq.${email}` });
			const existingConsent = await supabaseAdminFetch(`email_marketing_consents?${consentQuery}`);
			if (!existingConsent.ok) return Response.json({ error: "Could not check the consent ledger for withdrawal." }, { status: 502 });
			if ((await existingConsent.json() as unknown[]).length > 0) {
				const consentUpdate = await supabaseAdminFetch(`email_marketing_consents?${consentQuery}`, {
					method: "PATCH", headers: { Prefer: "return=minimal" },
					body: JSON.stringify({ status: "withdrawn", revoked_at: occurredAt, legal_basis: "withdrawn", source: "resend_webhook" }),
				});
				if (!consentUpdate.ok) return Response.json({ error: "Could not withdraw the marketing consent record." }, { status: 502 });
			} else {
				const consentInsert = await supabaseAdminFetch("email_marketing_consents", {
					method: "POST", headers: { Prefer: "return=minimal" },
					body: JSON.stringify({ organization_id: recipient.organization_id, client_id: recipient.client_id, email, status: "withdrawn", legal_basis: "withdrawn", source: "resend_webhook", revoked_at: occurredAt }),
				});
				if (!consentInsert.ok) return Response.json({ error: "Could not record withdrawn marketing consent." }, { status: 502 });
			}
		}
	}
	return Response.json({ received: true });
}
