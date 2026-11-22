type Reminder = {
	id: string;
	organization_id: string;
	user_id: string;
	reminder_kind: "deadline_approaching" | "task_overdue" | "meeting_reminder";
	attempts: number;
	failed_at: string | null;
	event_id: string | null;
	task_id: string | null;
	calendar_events: { title: string } | null;
	work_tasks: { title: string } | null;
};

Deno.serve(async (request) => {
	const expectedSecret = Deno.env.get("REMINDER_JOB_SECRET");
	if (!expectedSecret || request.headers.get("authorization") !== `Bearer ${expectedSecret}`) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const supabaseUrl = Deno.env.get("SUPABASE_URL");
	const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
	if (!supabaseUrl || !serviceKey) {
		return Response.json({ error: "Reminder worker is not configured" }, { status: 503 });
	}

	const headers = {
		apikey: serviceKey,
		Authorization: `Bearer ${serviceKey}`,
		"Content-Type": "application/json",
	};
	const dueUrl = new URL(`${supabaseUrl}/rest/v1/reminder_queue`);
	dueUrl.searchParams.set("select", "id,organization_id,user_id,reminder_kind,attempts,event_id,task_id,calendar_events(title),work_tasks(title)");
	dueUrl.searchParams.set("scheduled_for", `lte.${new Date().toISOString()}`);
	dueUrl.searchParams.set("delivered_at", "is.null");
	dueUrl.searchParams.set("failed_at", "is.null");
	dueUrl.searchParams.set("or", `(claimed_at.is.null,claimed_at.lt.${new Date(Date.now() - 5 * 60 * 1000).toISOString()})`);
	dueUrl.searchParams.set("order", "scheduled_for.asc");
	dueUrl.searchParams.set("limit", "100");

	const listResponse = await fetch(dueUrl, { headers });
	if (!listResponse.ok) return Response.json({ error: "Could not read the reminder queue" }, { status: 502 });
	const reminders = await listResponse.json() as Reminder[];
	let delivered = 0;

	for (const reminder of reminders) {
		const rowUrl = new URL(`${supabaseUrl}/rest/v1/reminder_queue`);
		rowUrl.searchParams.set("id", `eq.${reminder.id}`);
		rowUrl.searchParams.set("delivered_at", "is.null");
		const claimUrl = new URL(rowUrl);
		claimUrl.searchParams.set("or", `(claimed_at.is.null,claimed_at.lt.${new Date(Date.now() - 5 * 60 * 1000).toISOString()})`);
		const claimResponse = await fetch(claimUrl, {
			method: "PATCH",
			headers: { ...headers, Prefer: "return=representation" },
			body: JSON.stringify({ claimed_at: new Date().toISOString(), attempts: reminder.attempts + 1 }),
		});
		if (!claimResponse.ok) continue;
		const claimed = await claimResponse.json() as { id: string }[];
		if (claimed.length === 0) continue;

		const title = reminder.calendar_events?.title ?? reminder.work_tasks?.title ?? "Scheduled work item";
		const isMeeting = reminder.reminder_kind === "meeting_reminder";
		const kind = reminder.reminder_kind;
		const notificationUrl = new URL(`${supabaseUrl}/rest/v1/work_notifications`);
		notificationUrl.searchParams.set("on_conflict", "source_reminder_id");
		const notificationResponse = await fetch(notificationUrl, {
			method: "POST",
			headers: { ...headers, Prefer: "resolution=ignore-duplicates,return=minimal" },
			body: JSON.stringify({
				organization_id: reminder.organization_id,
				user_id: reminder.user_id,
				kind,
				title: isMeeting ? "Upcoming meeting" : kind === "task_overdue" ? "Task deadline passed" : "Task due tomorrow",
				message: title,
				entity_type: isMeeting ? "calendar_event" : "task",
				entity_id: reminder.event_id ?? reminder.task_id,
				source_reminder_id: reminder.id,
			}),
		});
		if (!notificationResponse.ok) {
			const retryAt = new Date(Date.now() + Math.min(60 * 60 * 1000, 60 * 1000 * 2 ** reminder.attempts));
			await fetch(rowUrl, {
				method: "PATCH",
				headers: { ...headers, Prefer: "return=minimal" },
				body: JSON.stringify(reminder.attempts + 1 >= 5
					? { claimed_at: null, failed_at: new Date().toISOString(), failure_reason: "Notification delivery retry limit reached" }
					: { claimed_at: null, scheduled_for: retryAt.toISOString() }),
			});
			continue;
		}
		const completeResponse = await fetch(rowUrl, {
			method: "PATCH",
			headers: { ...headers, Prefer: "return=minimal" },
			body: JSON.stringify({ delivered_at: new Date().toISOString(), claimed_at: null }),
		});
		if (!completeResponse.ok) continue;
		delivered += 1;
	}

	return Response.json({ processed: reminders.length, delivered });
});