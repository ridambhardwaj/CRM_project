import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdminConfig, supabaseAdminFetch } from "@/app/lib/supabase-admin";

function schedulerAuthorized(request: Request) {
	const expected = Buffer.from(process.env.CAMPAIGN_SCHEDULER_SECRET || "");
	const provided = Buffer.from(request.headers.get("x-campaign-scheduler-token") || "");
	return expected.length > 0 && expected.length === provided.length && timingSafeEqual(expected, provided);
}

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }) {
	if (!schedulerAuthorized(request)) return Response.json({ error: "Scheduler is not authorized." }, { status: 401 });
	const config = getSupabaseAdminConfig();
	if (!config) return Response.json({ error: "Campaign database is not configured." }, { status: 503 });
	const { campaignId } = await context.params;
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) {
		return Response.json({ error: "Invalid campaign ID." }, { status: 400 });
	}
	const now = new Date();
	const lookup = new URLSearchParams({ select: "id,status,scheduled_at,updated_at", id: `eq.${campaignId}`, organization_id: `eq.${config.organizationId}`, limit: "1" });
	const campaignResponse = await supabaseAdminFetch(`email_campaigns?${lookup}`);
	if (!campaignResponse.ok) return Response.json({ error: "Could not check the scheduled campaign." }, { status: 502 });
	const [campaign] = await campaignResponse.json() as { id: string; status: string; scheduled_at: string | null; updated_at: string }[];
	if (!campaign) return Response.json({ error: "Campaign not found." }, { status: 404 });
	if (campaign.status === "sending") {
		const startedAt = new Date(campaign.updated_at).getTime();
		if (Number.isFinite(startedAt) && now.getTime() - startedAt > 30 * 60 * 1000) {
			const staleQuery = new URLSearchParams({ id: `eq.${campaign.id}`, organization_id: `eq.${config.organizationId}`, status: "eq.sending", updated_at: `lt.${new Date(now.getTime() - 30 * 60 * 1000).toISOString()}` });
			await supabaseAdminFetch(`email_campaigns?${staleQuery}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", dispatch_token: null }) });
		}
		return Response.json({ error: "Campaign is already being dispatched or requires reconciliation." }, { status: 409 });
	}
	if (campaign.status !== "scheduled" || !campaign.scheduled_at || new Date(campaign.scheduled_at).getTime() > now.getTime()) {
		return Response.json({ error: "Campaign is not due for dispatch." }, { status: 409 });
	}
	const dispatchToken = crypto.randomUUID();
	const claimQuery = new URLSearchParams({ id: `eq.${campaign.id}`, organization_id: `eq.${config.organizationId}`, status: "eq.scheduled", scheduled_at: `lte.${now.toISOString()}` });
	const claimResponse = await supabaseAdminFetch(`email_campaigns?${claimQuery}`, {
		method: "PATCH", headers: { Prefer: "return=representation" },
		body: JSON.stringify({ status: "sending", dispatch_token: dispatchToken, dispatch_started_at: now.toISOString() }),
	});
	if (!claimResponse.ok) return Response.json({ error: "Could not claim this campaign for dispatch." }, { status: 502 });
	if (!(await claimResponse.json() as unknown[]).length) return Response.json({ error: "Campaign was claimed by another worker." }, { status: 409 });
	return Response.json({ campaignId: campaign.id, dispatchToken });
}

export async function PATCH(request: Request, context: { params: Promise<{ campaignId: string }> }) {
	if (!schedulerAuthorized(request)) return Response.json({ error: "Scheduler is not authorized." }, { status: 401 });
	const config = getSupabaseAdminConfig();
	if (!config) return Response.json({ error: "Campaign database is not configured." }, { status: 503 });
	const { campaignId } = await context.params;
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) return Response.json({ error: "Invalid campaign ID." }, { status: 400 });
	let payload: { dispatchToken?: unknown; reason?: unknown };
	try { payload = await request.json(); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
	if (typeof payload.dispatchToken !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.dispatchToken)) return Response.json({ error: "Invalid dispatch token." }, { status: 400 });
	const query = new URLSearchParams({ id: `eq.${campaignId}`, organization_id: `eq.${config.organizationId}`, status: "eq.sending", dispatch_token: `eq.${payload.dispatchToken}` });
	const response = await supabaseAdminFetch(`email_campaigns?${query}`, {
		method: "PATCH", headers: { Prefer: "return=representation" },
		body: JSON.stringify({ status: "failed", dispatch_token: null }),
	});
	if (!response.ok) return Response.json({ error: "Could not record campaign dispatch failure." }, { status: 502 });
	if (!(await response.json() as unknown[]).length) return Response.json({ error: "Dispatch claim expired or changed." }, { status: 409 });
	return Response.json({ status: "failed", reason: typeof payload.reason === "string" ? payload.reason.slice(0, 500) : "Scheduled campaign could not be dispatched" });
}
