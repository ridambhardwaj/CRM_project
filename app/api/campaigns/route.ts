import { getSupabaseAdminConfig, supabaseAdminFetch } from "@/app/lib/supabase-admin";

function cleanText(value: unknown, limit: number) {
	return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function escapeHtml(value: string) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function renderHtml(subject: string, headline: string, body: string, ctaText: string, ctaUrl: string, signature: string) {
	const paragraphs = body.split("\n").map((paragraph) => `<p style="margin:0 0 16px;line-height:1.6;color:#344054">${escapeHtml(paragraph) || "&nbsp;"}</p>`).join("");
	const safeUrl = /^(https?:\/\/|mailto:)/i.test(ctaUrl) ? ctaUrl : "";
	const cta = ctaText && safeUrl ? `<p style="margin:24px 0"><a href="${escapeHtml(safeUrl)}" style="background:#ed6a5a;color:#fff;text-decoration:none;padding:12px 20px;font-weight:700">${escapeHtml(ctaText)}</a></p>` : "";
	return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:auto;background:#fff"><tr><td style="padding:32px">${headline ? `<h1 style="color:#17253a">${escapeHtml(headline)}</h1>` : `<h1 style="color:#17253a">${escapeHtml(subject)}</h1>`}${paragraphs}${cta}<p style="line-height:1.6;color:#344054">${escapeHtml(signature).replaceAll("\n", "<br>")}</p><hr style="border:0;border-top:1px solid #e6e9ee"><p style="font-size:12px;color:#7a8492">You received this message because of your email preferences. <a href="{{unsubscribe_url}}">Unsubscribe</a></p></td></tr></table></body></html>`;
}

export async function GET(request: Request) {
	const config = getSupabaseAdminConfig();
	if (!config) return Response.json({ campaigns: [] });

	const url = new URL(request.url);
	const query = new URLSearchParams({
		select: "id,name,category,status,subject,text_body,scheduled_at,audience_rules,created_at,updated_at,sent_at",
		organization_id: `eq.${config.organizationId}`,
		order: "updated_at.desc",
		limit: "100",
	});
	if (url.searchParams.get("scheduled_due") === "1") {
		query.set("status", "eq.scheduled");
		query.set("scheduled_at", `lte.${new Date().toISOString()}`);
		query.set("order", "scheduled_at.asc");
		const staleQuery = new URLSearchParams({
			select: "id",
			organization_id: `eq.${config.organizationId}`,
			status: "eq.sending",
			updated_at: `lt.${new Date(Date.now() - 30 * 60 * 1000).toISOString()}`,
			limit: "100",
		});
		const staleResponse = await supabaseAdminFetch(`email_campaigns?${staleQuery}`);
		if (!staleResponse.ok) return Response.json({ error: "Could not reconcile stale campaign sends." }, { status: 502 });
		const staleCampaigns = await staleResponse.json() as { id: string }[];
		for (const staleCampaign of staleCampaigns) {
			const staleUpdate = new URLSearchParams({ id: `eq.${staleCampaign.id}`, organization_id: `eq.${config.organizationId}`, status: "eq.sending" });
			const reconcileResponse = await supabaseAdminFetch(`email_campaigns?${staleUpdate}`, {
				method: "PATCH", headers: { Prefer: "return=minimal" },
				body: JSON.stringify({ status: "failed", dispatch_token: null }),
			});
			if (!reconcileResponse.ok) return Response.json({ error: "Could not mark an interrupted campaign for manual reconciliation." }, { status: 502 });
		}
	}
	const response = await supabaseAdminFetch(`email_campaigns?${query}`);
	if (!response.ok) return Response.json({ error: "Could not load campaign records." }, { status: 502 });
	return Response.json({ campaigns: await response.json() });
}

export async function POST(request: Request) {
	const config = getSupabaseAdminConfig();
	if (!config) return Response.json({ error: "Campaign database is not configured." }, { status: 503 });

	let payload: Record<string, unknown>;
	try { payload = await request.json(); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
	const subject = cleanText(payload.subject, 160);
	const body = cleanText(payload.body, 8000);
	const name = cleanText(payload.name, 180) || subject;
	const category = cleanText(payload.category, 60) || "Professional";
	const status = payload.status === "needs_approval" ? "needs_approval" : "draft";
	const scheduledAt = cleanText(payload.scheduledAt, 64);
	const parsedSchedule = scheduledAt ? new Date(scheduledAt) : null;
	if (!subject || !body) return Response.json({ error: "Campaign subject and message are required." }, { status: 400 });
	if (scheduledAt && (!parsedSchedule || Number.isNaN(parsedSchedule.getTime()) || parsedSchedule.getTime() <= Date.now())) {
		return Response.json({ error: "Choose a valid future schedule time." }, { status: 400 });
	}
	const ctaUrl = cleanText(payload.ctaUrl, 500);
	const campaign = {
		organization_id: config.organizationId,
		created_by: config.operatorUserId,
		name,
		category,
		operating_mode: "approval",
		status,
		subject,
		headline: cleanText(payload.headline, 200),
		text_body: body,
		html_body: renderHtml(subject, cleanText(payload.headline, 200), body, cleanText(payload.ctaText, 100), ctaUrl, cleanText(payload.signature, 500)),
		cta_text: cleanText(payload.ctaText, 100),
		cta_url: /^(https?:\/\/|mailto:)/i.test(ctaUrl) ? ctaUrl : "",
		signature: cleanText(payload.signature, 500),
		audience_rules: payload.audienceRules && typeof payload.audienceRules === "object" ? payload.audienceRules : { clientIds: [] },
		scheduled_at: parsedSchedule?.toISOString() ?? null,
	};
	const response = await supabaseAdminFetch("email_campaigns", {
		method: "POST",
		headers: { Prefer: "return=representation" },
		body: JSON.stringify(campaign),
	});
	if (!response.ok) return Response.json({ error: "Could not save this campaign to the configured database." }, { status: 502 });
	const saved = await response.json();
	return Response.json({ campaign: Array.isArray(saved) ? saved[0] : saved }, { status: 201 });
}
