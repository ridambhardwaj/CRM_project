import { verifyUnsubscribeToken } from "@/app/lib/email-unsubscribe";
import { getSupabaseAdminConfig, supabaseAdminFetch } from "@/app/lib/supabase-admin";

function page(title: string, message: string, form?: string) {
	return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><body style="margin:0;padding:48px 16px;background:#f6f7f9;font:16px/1.5 Arial,sans-serif;color:#18212f"><main style="max-width:520px;margin:auto;padding:28px;background:white;border:1px solid #e4e7ec"><h1 style="font-size:22px">${title}</h1><p>${message}</p>${form || ""}</main></body></html>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function validParams(params: URLSearchParams) {
	const organizationId = params.get("organization_id") || "";
	const email = (params.get("email") || "").trim().toLowerCase();
	const token = params.get("token") || "";
	const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId);
	return validId && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && verifyUnsubscribeToken(organizationId, email, token)
		? { organizationId, email, token }
		: null;
}

export async function GET(request: Request) {
	const params = validParams(new URL(request.url).searchParams);
	if (!params) return page("Link unavailable", "This unsubscribe link is invalid or has expired.");
	return page("Confirm unsubscribe", `Confirm that you want to stop promotional email to ${params.email}.`, `<form method="post"><input type="hidden" name="organization_id" value="${params.organizationId}"><input type="hidden" name="email" value="${params.email}"><input type="hidden" name="token" value="${params.token}"><input type="hidden" name="unsubscribe_confirmation" value="confirmed"><button style="border:0;background:#17253a;color:white;padding:12px 18px;font-weight:700" type="submit">Unsubscribe</button></form>`);
}

export async function POST(request: Request) {
	const url = new URL(request.url);
	const contentType = request.headers.get("content-type") || "";
	let bodyParams = new URLSearchParams();
	try {
		if (contentType.includes("application/x-www-form-urlencoded")) bodyParams = new URLSearchParams(await request.text());
		else if (contentType.includes("multipart/form-data")) {
			const formData = await request.formData();
			for (const key of ["organization_id", "email", "token"]) bodyParams.set(key, String(formData.get(key) || ""));
		}
	} catch {
		return page("Request unavailable", "We could not read this email preference request.");
	}
	const params = validParams(new URLSearchParams({
		organization_id: bodyParams.get("organization_id") || url.searchParams.get("organization_id") || "",
		email: bodyParams.get("email") || url.searchParams.get("email") || "",
		token: bodyParams.get("token") || url.searchParams.get("token") || "",
	}));
	if (!params) return page("Link unavailable", "This unsubscribe link is invalid or has expired.");
	const oneClick = bodyParams.get("List-Unsubscribe") === "One-Click";
	const userConfirmed = bodyParams.get("unsubscribe_confirmation") === "confirmed";
	if (!oneClick && !userConfirmed) {
		return page("Confirm unsubscribe", `Confirm that you want to stop promotional email to ${params.email}.`, `<form method="post"><input type="hidden" name="organization_id" value="${params.organizationId}"><input type="hidden" name="email" value="${params.email}"><input type="hidden" name="token" value="${params.token}"><button style="border:0;background:#17253a;color:white;padding:12px 18px;font-weight:700" type="submit">Unsubscribe</button></form>`);
	}
	const config = getSupabaseAdminConfig();
	if (!config || params.organizationId !== config.organizationId) return page("Request unavailable", "The email preference service is not configured for this workspace.");

	const now = new Date().toISOString();
	const suppressionQuery = new URLSearchParams({ on_conflict: "organization_id,email" });
	const suppressionResponse = await supabaseAdminFetch(`email_suppressions?${suppressionQuery}`, {
		method: "POST",
		headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
		body: JSON.stringify({ organization_id: params.organizationId, email: params.email, reason: "unsubscribe", source: "signed_unsubscribe_link" }),
	});
	if (!suppressionResponse.ok) return page("Request failed", "We could not update your preferences right now. Please try again later.");

	const consentQuery = new URLSearchParams({ on_conflict: "organization_id,email" });
	const consentResponse = await supabaseAdminFetch(`email_marketing_consents?${consentQuery}`, {
		method: "POST",
		headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
		body: JSON.stringify({ organization_id: params.organizationId, email: params.email, status: "withdrawn", legal_basis: "withdrawn", source: "signed_unsubscribe_link", revoked_at: now }),
	});
	if (!consentResponse.ok) return page("Request failed", "Your suppression request was recorded, but we could not update the consent ledger. Please contact the sender.");
	return page("Unsubscribed", `${params.email} has been added to the suppression list.`);
}
