type AssistantRequest = { prompt?: unknown };

const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_API_VERSION = "v1beta";

function buildGeminiPrompt(userPrompt: string) {
	return `You are an AI Email Marketing Assistant. The user wants: "${userPrompt}".

Return ONLY a JSON object with this exact shape:
{
  "replyMessage": "short friendly confirmation of what you created",
  "category": "Promotion | Professional | Follow-up | Service introduction | Sales / lead generation | Meeting request | Offer / discount | Seasonal greeting | Payment reminder | Retention | Partnership | Welcome | Thank-you",
  "templateStyle": "corporate | minimal | modern | premium | promotional | creative",
  "tone": "Warm and clear | Direct and professional | Friendly and conversational | Confident and concise | Empathetic and helpful | Persuasive and energetic",
  "brief": "restated one-line goal",
  "suggestedAudience": "who this should go to",
  "variants": [
    {
      "subjectOptions": ["3 concise subject lines"],
      "headline": "email headline",
      "body": "email body text (use \n for paragraphs, include {{first_name}} and {{company_name}} placeholders)",
      "ctaText": "button label",
      "ctaUrl": "https://example.com",
      "signature": "Best regards,\nTeam"
    }
  ]
}

Rules:
- Do not invent products, prices, discounts, deadlines, or claims about the user's business.
- Keep it professional, concise, and mobile-friendly.
- Include one clear call to action.
- Add an opt-out sentence for marketing emails.
- Return valid JSON only, no markdown fences, no extra text.`;
}

export async function POST(request: Request) {
	let payload: AssistantRequest;
	try { payload = await request.json(); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

	const userPrompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
	if (userPrompt.length < 3) {
		return Response.json({ error: "Please provide a prompt for the AI assistant." }, { status: 400 });
	}

	const apiKey = process.env.GEMINI_API_KEY || "";
	if (!apiKey) {
		return Response.json({ error: "AI generation is not configured. Set GEMINI_API_KEY in .env.local." }, { status: 503 });
	}

	try {
		const response = await fetch(`https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents: [{ parts: [{ text: buildGeminiPrompt(userPrompt) }] }],
				generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
			}),
		});

		if (!response.ok) {
			const err = await response.json().catch(() => ({}));
			return Response.json({ error: `Gemini API error: ${err.error?.message || response.statusText}` }, { status: 502 });
		}

		const result = await response.json();
		const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
		const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
		const parsed = JSON.parse(cleaned);

		return Response.json({ success: true, ...parsed });
	} catch (caught) {
		return Response.json({ error: caught instanceof Error ? caught.message : "The AI assistant could not respond." }, { status: 502 });
	}
}