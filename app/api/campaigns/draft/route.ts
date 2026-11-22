type DraftRequest = { prompt?: unknown };

export async function POST(request: Request) {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		return Response.json({ error: "Campaign drafting is not configured. Add OPENAI_API_KEY to the server environment." }, { status: 503 });
	}

	let payload: DraftRequest;
	try {
		payload = await request.json();
	} catch {
		return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
	}

	if (typeof payload.prompt !== "string" || payload.prompt.trim().length < 8 || payload.prompt.length > 2000) {
		return Response.json({ error: "Enter a campaign prompt between 8 and 2,000 characters." }, { status: 400 });
	}

	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: process.env.OPENAI_MODEL || "gpt-4o-mini",
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content: "Write concise, truthful promotional emails. Return JSON with string fields subject and body. Use {{first_name}} for the recipient's first name. Do not invent discounts, dates, guarantees, or product facts that are not in the prompt. Include a clear call to action and a brief opt-out line asking the recipient to reply unsubscribe.",
				},
				{ role: "user", content: payload.prompt.trim() },
			],
		}),
	});

	if (!response.ok) {
		return Response.json({ error: "The AI provider could not draft this campaign." }, { status: 502 });
	}

	const result = await response.json();
	const content = result.choices?.[0]?.message?.content;
	try {
		const draft = JSON.parse(content);
		if (typeof draft.subject !== "string" || typeof draft.body !== "string") throw new Error("Invalid draft");
		return Response.json({ subject: draft.subject.slice(0, 160), body: draft.body.slice(0, 8000) });
	} catch {
		return Response.json({ error: "The AI provider returned an invalid draft. Please try again." }, { status: 502 });
	}
}