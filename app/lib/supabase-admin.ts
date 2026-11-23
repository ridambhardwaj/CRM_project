import { timingSafeEqual } from "node:crypto";

export type SupabaseAdminConfig = {
	url: string;
	serviceRoleKey: string;
	organizationId: string;
	operatorUserId: string;
};

export function getSupabaseAdminConfig(): SupabaseAdminConfig | null {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	const organizationId = process.env.CAMPAIGN_ORGANIZATION_ID;
	const operatorUserId = process.env.CAMPAIGN_OPERATOR_USER_ID;
	if (!url || !serviceRoleKey || !organizationId || !operatorUserId) return null;
	return { url: url.replace(/\/$/, ""), serviceRoleKey, organizationId, operatorUserId };
}

export function isAuthorizedCampaignOperator(request: Request) {
	const expected = process.env.CAMPAIGN_SEND_TOKEN || "";
	const provided = request.headers.get("x-campaign-token") || "";
	const expectedBuffer = Buffer.from(expected);
	const providedBuffer = Buffer.from(provided);
	return expectedBuffer.length > 0 && expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export function supabaseAdminFetch(path: string, init: RequestInit = {}) {
	const config = getSupabaseAdminConfig();
	if (!config) throw new Error("Supabase server configuration is missing.");
	const headers = new Headers(init.headers);
	headers.set("apikey", config.serviceRoleKey);
	headers.set("Authorization", `Bearer ${config.serviceRoleKey}`);
	headers.set("Content-Type", "application/json");
	return fetch(`${config.url}/rest/v1/${path.replace(/^\//, "")}`, { ...init, headers, cache: "no-store" });
}
