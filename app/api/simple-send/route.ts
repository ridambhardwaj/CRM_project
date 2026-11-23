import { createUnsubscribeToken } from "@/app/lib/email-unsubscribe";
import { getSupabaseAdminConfig } from "@/app/lib/supabase-admin";

type SendPayload = {
	to?: unknown;
	subject?: unknown;
	body?: unknown;
	html?: unknown;
};

function bounded(value: unknown, limit: number) {
	return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export async function POST(request: Request) {
	const resendKey = process.env.RESEND_API_KEY;
	const from = process.env.RESEND_FROM_EMAIL;
	if (!resendKey || !from) {
		return Response.json({ error: "Email sending is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL." }, { status: 503 });
	}

	let payload: SendPayload;
	try { payload = await request.json(); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

	const rawTo = Array.isArray(payload.to) ? payload.to : typeof payload.to === "string" ? [payload.to] : [];
	const tos = rawTo.map((t) => typeof t === "string" ? t.trim() : "").filter(Boolean);
	if (tos.length === 0 || tos.length > 50 || tos.some((t) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))) {
		return Response.json({ error: "Provide between 1 and 50 valid recipient email addresses." }, { status: 400 });
	}

	const subject = bounded(payload.subject, 160) || "(no subject)";
	const body = bounded(payload.body, 8000);
	const html = typeof payload.html === "string" ? payload.html : `<p>${body.replaceAll("\n", "<br>")}</p>`;
	const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

	const config = getSupabaseAdminConfig();
	const orgId = config?.organizationId || "simple";

	let sent = 0;
	const failed: string[] = [];
	for (const email of tos) {
		const unsubscribeToken = config ? createUnsubscribeToken(orgId, email) : "";
		const unsubscribeUrl = new URL("/api/campaigns/unsubscribe", appBaseUrl);
		unsubscribeUrl.searchParams.set("organization_id", orgId);
		unsubscribeUrl.searchParams.set("email", email);
		unsubscribeUrl.searchParams.set("token", unsubscribeToken);

		try {
			const response = await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
				body: JSON.stringify({
					from,
					to: [email],
					reply_to: process.env.RESEND_REPLY_TO_EMAIL || from,
					subject,
					text: `${body}\n\nUnsubscribe: ${unsubscribeUrl.toString()}`,
					html: html.replace("{{unsubscribe_url}}", unsubscribeUrl.toString()),
					headers: { "List-Unsubscribe": `<${unsubscribeUrl.toString()}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
				}),
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(typeof result.message === "string" ? result.message : "Provider rejected message.");
			sent += 1;
		} catch {
			failed.push(email);
		}
	}
	return Response.json({ sent, failed, total: tos.length });
}