import { createUnsubscribeToken } from "@/app/lib/email-unsubscribe";
import { getSupabaseAdminConfig, supabaseAdminFetch } from "@/app/lib/supabase-admin";

type SendPayload = { campaignId?: unknown; contactIds?: unknown; consentConfirmed?: unknown; scheduledDispatch?: unknown; dispatchToken?: unknown; finalBatch?: unknown };
type Client = { id: string; name: string; company: string; email: string; details: string };
type Consent = { client_id: string | null; email: string };
type Campaign = { id: string; status: string; subject: string; text_body: string; html_body: string; scheduled_at: string | null; dispatch_token: string | null; audience_rules: { clientIds?: string[] } };

function inFilter(values: string[]) {
	return `in.(${values.map((value) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`).join(",")})`;
}

function isUuid(value: unknown): value is string {
	return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function htmlEscape(value: string) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export async function POST(request: Request) {
	const config = getSupabaseAdminConfig();
	const resendKey = process.env.RESEND_API_KEY;
	const from = process.env.RESEND_FROM_EMAIL;
	const appBaseUrl = process.env.APP_BASE_URL;
	if (!config || !resendKey || !from || !appBaseUrl || !process.env.UNSUBSCRIBE_SECRET) {
		return Response.json({ error: "Campaign database, sender, app URL, or unsubscribe signing is not configured." }, { status: 503 });
	}

	let payload: SendPayload;
	try { payload = await request.json(); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
	if (payload.consentConfirmed !== true) return Response.json({ error: "Confirm the selected, recorded-consent audience before sending." }, { status: 400 });
	if (!isUuid(payload.campaignId) || !Array.isArray(payload.contactIds) || payload.contactIds.length === 0 || payload.contactIds.length > 500 || !payload.contactIds.every(isUuid)) {
		return Response.json({ error: "Choose one approved campaign and between 1 and 500 valid CRM recipients." }, { status: 400 });
	}
	const clientIds = [...new Set(payload.contactIds)];
	if (clientIds.length !== payload.contactIds.length) return Response.json({ error: "Duplicate recipients are not allowed." }, { status: 400 });
	const scheduledDispatch = payload.scheduledDispatch === true;
	const campaignQuery = new URLSearchParams({ select: "id,status,subject,text_body,html_body,scheduled_at,dispatch_token,audience_rules", id: `eq.${payload.campaignId}`, organization_id: `eq.${config.organizationId}`, limit: "1" });
	const campaignResponse = await supabaseAdminFetch(`email_campaigns?${campaignQuery}`);
	if (!campaignResponse.ok) return Response.json({ error: "Could not verify campaign approval." }, { status: 502 });
	const campaigns = await campaignResponse.json() as Campaign[];
	const campaign = campaigns[0];
	const approvedClientIds = Array.isArray(campaign?.audience_rules?.clientIds) ? [...new Set(campaign.audience_rules.clientIds)] : [];
	const requestedClientIds = [...clientIds].sort();
	const approvedAudience = new Set(approvedClientIds);
	const audienceMatches = scheduledDispatch
		? requestedClientIds.every((id) => approvedAudience.has(id))
		: approvedClientIds.length === requestedClientIds.length && [...approvedAudience].sort().every((id, index) => id === requestedClientIds[index]);
	if (!approvedClientIds.length || !audienceMatches) {
		return Response.json({ error: "The send audience must exactly match the recipients saved with the approved campaign." }, { status: 403 });
	}
	const scheduleIsDue = Boolean(campaign?.scheduled_at && new Date(campaign.scheduled_at).getTime() <= Date.now());
	const validDispatchLease = scheduledDispatch && campaign?.status === "sending" && isUuid(payload.dispatchToken) && payload.dispatchToken === campaign.dispatch_token && scheduleIsDue;
	if (!campaign || (scheduledDispatch ? !validDispatchLease : campaign.status !== "approved")) {
		return Response.json({ error: scheduledDispatch ? "Campaign is not an approved due schedule." : "Only a server-recorded approved campaign can be sent immediately." }, { status: 409 });
	}

	const clientQuery = new URLSearchParams({ select: "id,name,company,email,details", organization_id: `eq.${config.organizationId}`, id: inFilter(clientIds), limit: "100" });
	const clientResponse = await supabaseAdminFetch(`clients?${clientQuery}`);
	if (!clientResponse.ok) return Response.json({ error: "Could not validate CRM recipients." }, { status: 502 });
	const clients = await clientResponse.json() as Client[];
	if (clients.length !== clientIds.length) return Response.json({ error: "Every recipient must be a client in the configured organization." }, { status: 400 });

	const consentQuery = new URLSearchParams({ select: "client_id,email", organization_id: `eq.${config.organizationId}`, client_id: inFilter(clientIds), status: "in.(consented,legitimate_interest)", revoked_at: "is.null", limit: "500" });
	const consentResponse = await supabaseAdminFetch(`email_marketing_consents?${consentQuery}`);
	if (!consentResponse.ok) return Response.json({ error: "Could not re-check marketing consent." }, { status: 502 });
	const consents = await consentResponse.json() as Consent[];
	const validConsentByClient = new Map<string, Set<string>>();
	for (const consent of consents) {
		if (!consent.client_id) continue;
		const emailSet = validConsentByClient.get(consent.client_id) ?? new Set<string>();
		emailSet.add(consent.email.trim().toLowerCase());
		validConsentByClient.set(consent.client_id, emailSet);
	}
	const candidates = clients.map((client) => {
		const email = client.email.trim().toLowerCase();
		return { ...client, email, eligible: validConsentByClient.get(client.id)?.has(email) ?? false };
	});
	if (candidates.some((client) => !client.eligible)) return Response.json({ error: "At least one selected contact has no current consent for the CRM email address. No messages were sent." }, { status: 403 });

	const suppressionQuery = new URLSearchParams({ select: "email", organization_id: `eq.${config.organizationId}`, email: inFilter(candidates.map((client) => client.email)), limit: "500" });
	const suppressionResponse = await supabaseAdminFetch(`email_suppressions?${suppressionQuery}`);
	if (!suppressionResponse.ok) return Response.json({ error: "Could not check the suppression list." }, { status: 502 });
	const suppressed = new Set((await suppressionResponse.json() as { email: string }[]).map((row) => row.email.toLowerCase()));
	if (candidates.some((client) => suppressed.has(client.email))) return Response.json({ error: "At least one selected contact is suppressed or unsubscribed. No messages were sent." }, { status: 403 });

	if (!scheduledDispatch) {
		const lockQuery = new URLSearchParams({ id: `eq.${campaign.id}`, organization_id: `eq.${config.organizationId}`, status: "eq.approved" });
		const lockResponse = await supabaseAdminFetch(`email_campaigns?${lockQuery}`, {
			method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "sending" }),
		});
		if (!lockResponse.ok) return Response.json({ error: "Could not reserve this campaign for delivery." }, { status: 502 });
		if (!(await lockResponse.json() as unknown[]).length) return Response.json({ error: "Campaign state changed. Refresh and retry." }, { status: 409 });
	}

	const now = new Date().toISOString();
	const recipientRows = candidates.map((client) => ({ organization_id: config.organizationId, campaign_id: campaign.id, client_id: client.id, email: client.email, recipient_name: client.name, status: "queued" }));
	const queueResponse = await supabaseAdminFetch("email_campaign_recipients?on_conflict=campaign_id,email", {
		method: "POST",
		headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
		body: JSON.stringify(recipientRows),
	});
	if (!queueResponse.ok) return Response.json({ error: "Could not record campaign recipients before sending." }, { status: 502 });
	const queuedRows = await queueResponse.json() as { id: string; email: string; status: string }[];
	const rowByEmail = new Map(queuedRows.map((row) => [row.email.toLowerCase(), row]));
	if (rowByEmail.size !== candidates.length || queuedRows.some((row) => row.status !== "queued")) {
		return Response.json({ error: "One or more recipients already have a delivery record for this campaign." }, { status: 409 });
	}

	let sent = 0;
	const failed: string[] = [];
	const loggingFailures: string[] = [];
	for (const client of candidates) {
		const row = rowByEmail.get(client.email)!;
		const unsubscribeToken = createUnsubscribeToken(config.organizationId, client.email);
		const unsubscribeUrl = new URL("/api/campaigns/unsubscribe", appBaseUrl);
		unsubscribeUrl.searchParams.set("organization_id", config.organizationId);
		unsubscribeUrl.searchParams.set("email", client.email);
		unsubscribeUrl.searchParams.set("token", unsubscribeToken);
		const firstName = client.name.trim().split(/\s+/)[0] || "there";
		const personalizedText = campaign.text_body.replaceAll("{{first_name}}", firstName).replaceAll("{{company_name}}", client.company || "your organization");
		const personalizedHtml = campaign.html_body
			.replaceAll("{{first_name}}", htmlEscape(firstName))
			.replaceAll("{{company_name}}", htmlEscape(client.company || "your organization"))
			.replaceAll("{{unsubscribe_url}}", htmlEscape(unsubscribeUrl.toString()));
		let providerMessageId = "";
		let errorMessage = "";
		try {
			const finalConsentQuery = new URLSearchParams({ organization_id: `eq.${config.organizationId}`, email: `eq.${client.email}`, status: "in.(consented,legitimate_interest)", revoked_at: "is.null", limit: "1" });
			const finalConsentResponse = await supabaseAdminFetch(`email_marketing_consents?${finalConsentQuery}`);
			if (!finalConsentResponse.ok) errorMessage = "Could not re-verify consent immediately before sending.";
			else if (!(await finalConsentResponse.json() as Consent[]).some((consent) => consent.client_id === client.id)) errorMessage = "Consent was withdrawn before delivery.";
			if (!errorMessage) {
				const finalSuppressionQuery = new URLSearchParams({ organization_id: `eq.${config.organizationId}`, email: `eq.${client.email}`, limit: "1" });
				const finalSuppressionResponse = await supabaseAdminFetch(`email_suppressions?${finalSuppressionQuery}`);
				if (!finalSuppressionResponse.ok) errorMessage = "Could not re-check suppression status immediately before sending.";
				else if ((await finalSuppressionResponse.json() as { email: string }[]).length > 0) errorMessage = "Recipient was added to the suppression list before delivery.";
			}
		} catch {
			errorMessage = "Could not re-check consent and suppression immediately before sending.";
		}
		try {
			if (errorMessage) throw new Error(errorMessage);
			const response = await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
				body: JSON.stringify({
					from,
					to: [client.email],
					reply_to: process.env.RESEND_REPLY_TO_EMAIL || from,
					subject: campaign.subject.replaceAll("{{first_name}}", firstName).replaceAll("{{company_name}}", client.company || "your organization"),
					text: `${personalizedText}\n\nUnsubscribe: ${unsubscribeUrl.toString()}`,
					html: personalizedHtml,
					headers: { "List-Unsubscribe": `<${unsubscribeUrl.toString()}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
				}),
			});
			const providerResult = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(typeof providerResult.message === "string" ? providerResult.message : "Email provider rejected the message.");
			providerMessageId = typeof providerResult.id === "string" ? providerResult.id : "";
			sent += 1;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message.slice(0, 1000) : "Email provider request failed.";
			failed.push(client.email);
		}
		let deliveryLogOk = false;
		try {
			const deliveryLog = await supabaseAdminFetch(`email_campaign_recipients?id=eq.${row.id}&organization_id=eq.${config.organizationId}`, {
				method: "PATCH",
				headers: { Prefer: "return=minimal" },
				body: JSON.stringify({ status: errorMessage ? "failed" : "sent", provider_message_id: providerMessageId || null, error_message: errorMessage, sent_at: errorMessage ? null : new Date().toISOString() }),
			});
			deliveryLogOk = deliveryLog.ok;
		} catch {
			deliveryLogOk = false;
		}
		if (!deliveryLogOk) {
			loggingFailures.push(client.email);
		}
	}

	let finalStatus = "sending";
	if (!scheduledDispatch || payload.finalBatch === true) {
		const recipientStatusQuery = new URLSearchParams({ select: "status", organization_id: `eq.${config.organizationId}`, campaign_id: `eq.${campaign.id}`, limit: "10000" });
		const statusResponse = await supabaseAdminFetch(`email_campaign_recipients?${recipientStatusQuery}`);
		if (!statusResponse.ok) return Response.json({ sent, failed, status: "sending", reconciliationRequired: true, loggingFailures }, { status: 502 });
		const recipientStatuses = await statusResponse.json() as { status: string }[];
		finalStatus = failed.length || loggingFailures.length || recipientStatuses.some((recipient) => recipient.status === "failed" || recipient.status === "queued") ? "failed" : "sent";
	}
	let campaignLogOk = false;
	if (finalStatus !== "sending") {
		try {
			const campaignLog = await supabaseAdminFetch(`email_campaigns?id=eq.${campaign.id}&organization_id=eq.${config.organizationId}&status=eq.sending`, {
				method: "PATCH", headers: { Prefer: "return=minimal" },
				body: JSON.stringify({ status: finalStatus, sent_at: now, dispatch_token: null }),
			});
			campaignLogOk = campaignLog.ok;
		} catch {
			campaignLogOk = false;
		}
	} else {
		campaignLogOk = true;
	}
	if (!campaignLogOk) return Response.json({ sent, failed, status: finalStatus, reconciliationRequired: true, loggingFailures }, { status: 502 });
	return Response.json({ sent, failed, status: finalStatus, reconciliationRequired: loggingFailures.length > 0, loggingFailures });
}
