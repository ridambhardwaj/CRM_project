import { getSupabaseAdminConfig, supabaseAdminFetch } from "@/app/lib/supabase-admin";

type ConsentRow = { client_id: string | null; email: string };
type ClientRow = { id: string; name: string; company: string; email: string; details: string };

function inFilter(values: string[]) {
	return `in.(${values.map((value) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`).join(",")})`;
}

export async function GET(request: Request) {
	const config = getSupabaseAdminConfig();
	if (!config) return Response.json({ recipients: [], count: 0 });
	const consentQuery = new URLSearchParams({
		select: "client_id,email",
		organization_id: `eq.${config.organizationId}`,
		status: "in.(consented,legitimate_interest)",
		revoked_at: "is.null",
		limit: "500",
	});
	const consentResponse = await supabaseAdminFetch(`email_marketing_consents?${consentQuery}`);
	if (!consentResponse.ok) return Response.json({ error: "Could not load recorded marketing consent." }, { status: 502 });
	const consents = await consentResponse.json() as ConsentRow[];
	if (!consents.length) return Response.json({ recipients: [], count: 0 });
	const emails = [...new Set(consents.map((consent) => consent.email.trim().toLowerCase()))];
	const suppressionQuery = new URLSearchParams({
		select: "email",
		organization_id: `eq.${config.organizationId}`,
		email: inFilter(emails),
		limit: "1000",
	});
	const suppressionResponse = await supabaseAdminFetch(`email_suppressions?${suppressionQuery}`);
	if (!suppressionResponse.ok) return Response.json({ error: "Could not check the suppression list." }, { status: 502 });
	const suppressed = new Set((await suppressionResponse.json() as { email: string }[]).map((row) => row.email.toLowerCase()));
	const clientIds = [...new Set(consents.map((consent) => consent.client_id).filter((id): id is string => Boolean(id)))];
	if (!clientIds.length) return Response.json({ recipients: [], count: 0 });
	const clientsQuery = new URLSearchParams({
		select: "id,name,company,email,details",
		organization_id: `eq.${config.organizationId}`,
		id: inFilter(clientIds),
		limit: "500",
	});
	const clientsResponse = await supabaseAdminFetch(`clients?${clientsQuery}`);
	if (!clientsResponse.ok) return Response.json({ error: "Could not load CRM client details." }, { status: 502 });
	const clients = await clientsResponse.json() as ClientRow[];
	const clientById = new Map(clients.map((client) => [client.id, client]));
	const recipients = consents.flatMap((consent) => {
		const email = consent.email.trim().toLowerCase();
		const client = consent.client_id ? clientById.get(consent.client_id) : undefined;
		if (!client || suppressed.has(email)) return [];
		return [{ id: client.id, name: client.name, company: client.company, email, details: client.details }];
	});
	const requestedIds = new URL(request.url).searchParams.get("client_ids");
	if (requestedIds !== null) {
		const requested = requestedIds.split(",").filter(Boolean);
		if (requested.length > 500 || requested.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
			return Response.json({ error: "Invalid campaign audience selection." }, { status: 400 });
		}
		const selected = new Set(requested);
		const filteredRecipients = recipients.filter((recipient) => selected.has(recipient.id));
		return Response.json({ recipients: filteredRecipients, count: filteredRecipients.length });
	}
	return Response.json({ recipients, count: recipients.length });
}
