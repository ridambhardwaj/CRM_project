type CampaignRow = { id: string; status: string; scheduled_at: string; audience_rules?: { clientIds?: string[] } };
type Recipient = { id: string };

Deno.serve(async (request) => {
	const secret = Deno.env.get("CAMPAIGN_SCHEDULER_SECRET");
	if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}
	const appUrl = Deno.env.get("APP_BASE_URL");
	const operatorToken = Deno.env.get("CAMPAIGN_SEND_TOKEN");
	if (!appUrl || !operatorToken) return Response.json({ error: "Campaign scheduler is not configured" }, { status: 503 });
	const baseUrl = appUrl.replace(/\/$/, "");
	const headers = { "x-campaign-token": operatorToken };
	const campaignsResponse = await fetch(`${baseUrl}/api/campaigns?scheduled_due=1`, { headers });
	if (!campaignsResponse.ok) return Response.json({ error: "Could not load due campaigns" }, { status: 502 });
	const campaigns = (await campaignsResponse.json()).campaigns as CampaignRow[];
	let messagesSent = 0;
	const failures: { campaignId: string; reason: string }[] = [];

	for (const campaign of campaigns) {
		const claimResponse = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/dispatch`, {
			method: "POST",
			headers: { "x-campaign-scheduler-token": secret },
		});
		const claim = await claimResponse.json().catch(() => ({}));
		if (!claimResponse.ok) {
			failures.push({ campaignId: campaign.id, reason: typeof claim.error === "string" ? claim.error : "Could not claim schedule" });
			continue;
		}
		const approvedClientIds = Array.isArray(campaign.audience_rules?.clientIds) ? campaign.audience_rules.clientIds : [];
		if (!approvedClientIds.length) {
			failures.push({ campaignId: campaign.id, reason: "Campaign has no approved recipient selection" });
			await fetch(`${baseUrl}/api/campaigns/${campaign.id}/dispatch`, {
				method: "PATCH", headers: { "Content-Type": "application/json", "x-campaign-scheduler-token": secret },
				body: JSON.stringify({ dispatchToken: claim.dispatchToken, reason: "Campaign has no approved recipient selection" }),
			});
			continue;
		}
		const audienceResponse = await fetch(`${baseUrl}/api/campaigns/audience?client_ids=${encodeURIComponent(approvedClientIds.join(","))}`, { headers });
		if (!audienceResponse.ok) {
			failures.push({ campaignId: campaign.id, reason: "Could not load eligible audience" });
			await fetch(`${baseUrl}/api/campaigns/${campaign.id}/dispatch`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json", "x-campaign-scheduler-token": secret },
				body: JSON.stringify({ dispatchToken: claim.dispatchToken, reason: "Could not load eligible audience" }),
			});
			continue;
		}
		const recipients = (await audienceResponse.json()).recipients as Recipient[];
		if (!recipients.length) {
			failures.push({ campaignId: campaign.id, reason: "No consented, unsuppressed recipients are eligible" });
			await fetch(`${baseUrl}/api/campaigns/${campaign.id}/dispatch`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json", "x-campaign-scheduler-token": secret },
				body: JSON.stringify({ dispatchToken: claim.dispatchToken, reason: "No consented, unsuppressed recipients are eligible" }),
			});
			continue;
		}
		const batches: Recipient[][] = [];
		for (let index = 0; index < recipients.length; index += 100) batches.push(recipients.slice(index, index + 100));
		for (const [index, batch] of batches.entries()) {
			const sendResponse = await fetch(`${baseUrl}/api/campaigns/send`, {
				method: "POST",
				headers: { ...headers, "Content-Type": "application/json" },
				body: JSON.stringify({
					campaignId: campaign.id,
					contactIds: batch.map((recipient) => recipient.id),
					consentConfirmed: true,
					scheduledDispatch: true,
					dispatchToken: claim.dispatchToken,
					finalBatch: index === batches.length - 1,
				}),
			});
			const result = await sendResponse.json().catch(() => ({}));
			if (!sendResponse.ok) {
				const reason = typeof result.error === "string" ? result.error : "Delivery batch failed";
				failures.push({ campaignId: campaign.id, reason });
				await fetch(`${baseUrl}/api/campaigns/${campaign.id}/dispatch`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json", "x-campaign-scheduler-token": secret },
					body: JSON.stringify({ dispatchToken: claim.dispatchToken, reason }),
				});
				break;
			}
			messagesSent += Number(result.sent || 0);
			if (result.reconciliationRequired || result.status === "failed") {
				const reason = result.reconciliationRequired ? "Delivery status needs reconciliation" : "Campaign contains failed recipient deliveries";
				failures.push({ campaignId: campaign.id, reason });
				if (result.status !== "failed") {
					await fetch(`${baseUrl}/api/campaigns/${campaign.id}/dispatch`, {
						method: "PATCH",
						headers: { "Content-Type": "application/json", "x-campaign-scheduler-token": secret },
						body: JSON.stringify({ dispatchToken: claim.dispatchToken, reason }),
					});
				}
				break;
			}
		}
	}
	return Response.json({ dueCampaigns: campaigns.length, messagesSent, failures });
});
