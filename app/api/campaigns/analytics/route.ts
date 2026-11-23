import { getSupabaseAdminConfig, supabaseAdminFetch } from "@/app/lib/supabase-admin";

type Campaign = { id: string; name: string; subject: string; status: string };
type Recipient = { campaign_id: string; status: string };
type Event = { campaign_id: string; recipient_id: string | null; event_type: string; is_verified: boolean };

function percent(part: number, total: number) {
	return total ? Math.round((part / total) * 1000) / 10 : null;
}

async function fetchAllRows<T>(table: string, query: URLSearchParams): Promise<T[] | null> {
	const pageSize = 1000;
	const rows: T[] = [];
	for (let offset = 0; offset < 100000; offset += pageSize) {
		const pageQuery = new URLSearchParams(query);
		pageQuery.set("limit", String(pageSize));
		pageQuery.set("offset", String(offset));
		const response = await supabaseAdminFetch(`${table}?${pageQuery}`);
		if (!response.ok) return null;
		const page = await response.json() as T[];
		rows.push(...page);
		if (page.length < pageSize) return rows;
	}
	return null;
}

export async function GET(request: Request) {
	const config = getSupabaseAdminConfig();
	if (!config) return Response.json({ campaigns: [], verifiedTotals: { sent: 0, delivered: 0, bounced: 0, opened: 0, clicked: 0, unsubscribed: 0, deliveryRate: null, openRate: null, clickRate: null, unsubscribeRate: null } });

	const campaignQuery = new URLSearchParams({ select: "id,name,subject,status", organization_id: `eq.${config.organizationId}`, order: "created_at.desc" });
	const campaigns = await fetchAllRows<Campaign>("email_campaigns", campaignQuery);
	if (!campaigns) return Response.json({ error: "Could not load all campaign analytics." }, { status: 502 });
	if (!campaigns.length) return Response.json({ campaigns: [], verifiedTotals: { sent: 0, delivered: 0, bounced: 0, opened: 0, clicked: 0, unsubscribed: 0, deliveryRate: null, openRate: null, clickRate: null, unsubscribeRate: null } });

	const campaignIds = `in.(${campaigns.map((campaign) => `"${campaign.id}"`).join(",")})`;
	const recipientsQuery = new URLSearchParams({ select: "campaign_id,status", organization_id: `eq.${config.organizationId}`, campaign_id: campaignIds });
	const eventsQuery = new URLSearchParams({ select: "campaign_id,recipient_id,event_type,is_verified", organization_id: `eq.${config.organizationId}`, campaign_id: campaignIds, is_verified: "eq.true" });
	const [recipients, events] = await Promise.all([
		fetchAllRows<Recipient>("email_campaign_recipients", recipientsQuery),
		fetchAllRows<Event>("email_campaign_events", eventsQuery),
	]);
	if (!recipients || !events) return Response.json({ error: "Could not load all verified provider metrics." }, { status: 502 });
	const countEvents = (campaignId?: string, kind?: string) => new Set(events
		.filter((event) => (!campaignId || event.campaign_id === campaignId) && (!kind || event.event_type === kind))
		.map((event) => event.recipient_id)
		.filter((recipientId): recipientId is string => Boolean(recipientId))).size;
	const delivered = countEvents(undefined, "delivered");
	const opened = countEvents(undefined, "opened");
	const clicked = countEvents(undefined, "clicked");
	const unsubscribed = countEvents(undefined, "unsubscribed");
	const sent = recipients.filter((recipient) => ["sent", "delivered", "bounced", "unsubscribed"].includes(recipient.status)).length;
	const verifiedTotals = {
		sent,
		delivered,
		bounced: countEvents(undefined, "bounced"),
		opened,
		clicked,
		unsubscribed,
		deliveryRate: percent(delivered, sent),
		openRate: percent(opened, delivered),
		clickRate: percent(clicked, delivered),
		unsubscribeRate: percent(unsubscribed, delivered),
	};
	const suggestions: string[] = [];
	if (sent > 0 && verifiedTotals.deliveryRate !== null && verifiedTotals.deliveryRate < 95) {
		suggestions.push("Review address quality and bounce events before sending to a larger segment.");
	}
	if (delivered > 0 && clicked === 0) {
		suggestions.push("No verified clicks are recorded yet. Check that the message has one clear CTA with a working destination.");
	}
	if (delivered > 0 && unsubscribed > 0) {
		suggestions.push("Unsubscribes are recorded. Review audience relevance and campaign frequency before the next send.");
	}
	if (sent === 0) suggestions.push("Send an approved campaign to a consented audience before drawing conclusions from engagement metrics.");
	const campaignMetrics = campaigns.map((campaign) => {
		const campaignRecipients = recipients.filter((recipient) => recipient.campaign_id === campaign.id);
		const sentCount = campaignRecipients.filter((recipient) => ["sent", "delivered", "bounced", "unsubscribed"].includes(recipient.status)).length;
		const deliveredCount = countEvents(campaign.id, "delivered");
		const openedCount = countEvents(campaign.id, "opened");
		const clickedCount = countEvents(campaign.id, "clicked");
		return { ...campaign, sent: sentCount, delivered: deliveredCount, opened: openedCount, clicked: clickedCount, openRate: percent(openedCount, deliveredCount), clickRate: percent(clickedCount, deliveredCount) };
	});
	return Response.json({ campaigns: campaignMetrics, verifiedTotals, suggestions, source: "Signature-verified Resend webhook events and recipient delivery records" });
}
