import { getSupabaseAdminConfig, supabaseAdminFetch } from "@/app/lib/supabase-admin";

export async function PATCH(request: Request, context: { params: Promise<{ campaignId: string }> }) {
	let payload: { action?: unknown };
	try { payload = await request.json(); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
	const config = getSupabaseAdminConfig();
	if (!config) return Response.json({ error: "Campaign database is not configured." }, { status: 503 });
	const { campaignId } = await context.params;
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) {
		return Response.json({ error: "Invalid campaign ID." }, { status: 400 });
	}
	const lookup = new URLSearchParams({
		select: "id,status,scheduled_at,created_by",
		id: `eq.${campaignId}`,
		organization_id: `eq.${config.organizationId}`,
		limit: "1",
	});
	const existingResponse = await supabaseAdminFetch(`email_campaigns?${lookup}`);
	if (!existingResponse.ok) return Response.json({ error: "Could not check campaign state." }, { status: 502 });
	const existingRows = await existingResponse.json() as { id: string; status: string; scheduled_at: string | null; created_by: string }[];
	const existing = existingRows[0];
	if (!existing) return Response.json({ error: "Campaign not found." }, { status: 404 });

	let patch: Record<string, unknown>;
	if (payload.action === "approve") {
		if (existing.status !== "needs_approval") return Response.json({ error: "Only campaigns awaiting approval can be approved." }, { status: 409 });
		const isScheduled = Boolean(existing.scheduled_at && new Date(existing.scheduled_at).getTime() > Date.now());
		patch = { status: isScheduled ? "scheduled" : "approved", approved_at: new Date().toISOString() };
	} else if (payload.action === "cancel") {
		if (!["draft", "needs_approval", "approved", "scheduled"].includes(existing.status)) return Response.json({ error: "This campaign can no longer be cancelled." }, { status: 409 });
		patch = { status: "cancelled" };
	} else {
		return Response.json({ error: "Unsupported campaign action." }, { status: 400 });
	}
	const updateQuery = new URLSearchParams({ id: `eq.${campaignId}`, organization_id: `eq.${config.organizationId}`, status: `eq.${existing.status}` });
	const updateResponse = await supabaseAdminFetch(`email_campaigns?${updateQuery}`, {
		method: "PATCH",
		headers: { Prefer: "return=representation" },
		body: JSON.stringify(patch),
	});
	if (!updateResponse.ok) return Response.json({ error: "Could not update campaign status." }, { status: 502 });
	const updated = await updateResponse.json() as unknown[];
	if (!updated.length) return Response.json({ error: "Campaign state changed. Refresh and try again." }, { status: 409 });
	return Response.json({ campaign: updated[0] });
}
