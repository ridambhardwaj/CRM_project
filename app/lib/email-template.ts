export type EmailTemplateStyle =
	| "corporate"
	| "minimal"
	| "modern"
	| "premium"
	| "promotional"
	| "creative";

export const emailTemplateStyles: EmailTemplateStyle[] = [
	"corporate",
	"minimal",
	"modern",
	"premium",
	"promotional",
	"creative",
];

export type TemplateBrand = {
	primary?: string;
	accent?: string;
	logoUrl?: string;
	socialLinks?: Record<string, string>;
	footerText?: string;
};

export type RenderedEmailInput = {
	subject?: string;
	headline?: string;
	body: string;
	ctaText?: string;
	ctaUrl?: string;
	signature?: string;
};

export function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function safeColor(value: string | undefined, fallback: string) {
	return value && /^#[0-9a-f]{3,8}$/i.test(value.trim()) ? value.trim() : fallback;
}

function safeActionUrl(value: string | undefined) {
	const trimmed = (value || "").trim();
	return /^(https?:\/\/|mailto:)/i.test(trimmed) ? trimmed : "";
}

function safeImageUrl(value: string | undefined) {
	const trimmed = (value || "").trim();
	return /^https:\/\//i.test(trimmed) ? trimmed : "";
}

function socialLinksMarkup(links: Record<string, string> | undefined, accent: string) {
	if (!links || typeof links !== "object") return "";
	const entries = Object.entries(links)
		.filter(([, url]) => safeActionUrl(url))
		.slice(0, 8);
	if (!entries.length) return "";
	return `<p style="margin:18px 0 0;text-align:center;font-size:12px">${entries
		.map(([network, url]) => `<a href="${escapeHtml(safeActionUrl(url))}" style="color:${accent};text-decoration:none;margin:0 6px">${escapeHtml(network)}</a>`)
		.join(" · ")}</p>`;
}

function footerMarkup(footerText: string | undefined, primary: string) {
	const text = (footerText || "You are receiving this because you subscribed to updates from us.").trim();
	return `<p style="margin:0;text-align:center;font-size:11px;line-height:1.6;color:#8b93a0">${escapeHtml(text)}<br><a href="{{unsubscribe_url}}" style="color:${primary};text-decoration:underline">Unsubscribe</a> · <a href="{{preferences_url}}" style="color:${primary};text-decoration:underline">Email preferences</a></p>`;
}

export function renderEmailHtml(style: EmailTemplateStyle, input: RenderedEmailInput, brand: TemplateBrand = {}) {
	const primary = safeColor(brand.primary, "#17253a");
	const accent = safeColor(brand.accent, "#ed6a5a");
	const logo = safeImageUrl(brand.logoUrl);
	const headline = escapeHtml((input.headline || input.subject || "").trim());
	const body = input.body
		.split("\n")
		.map((paragraph) => `<p style="margin:0 0 16px;line-height:1.65;color:#344054">${escapeHtml(paragraph) || "&nbsp;"}</p>`)
		.join("");
	const ctaUrl = safeActionUrl(input.ctaUrl);
	const ctaLabel = (input.ctaText || "").trim();
	const cta = ctaLabel
		? ctaUrl
			? `<p style="margin:26px 0;text-align:center"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:13px 26px;border-radius:6px;font-weight:700">${escapeHtml(ctaLabel)}</a></p>`
			: `<p style="margin:26px 0;text-align:center;font-weight:700;color:${primary}">${escapeHtml(ctaLabel)}</p>`
		: "";
	const signature = escapeHtml((input.signature || "").trim()).replaceAll("\n", "<br>");
	const logoMarkup = logo
		? `<img src="${escapeHtml(logo)}" alt="Logo" width="140" style="display:block;margin:0 auto 16px;max-width:140px;height:auto">`
		: `<div style="margin:0 auto 16px;width:44px;height:44px;border-radius:10px;background:${accent};color:#fff;font-weight:800;font-size:20px;text-align:center;line-height:44px">${escapeHtml((headline || "E").slice(0, 1))}</div>`;

	const wrap = (inner: string, options: { maxWidth?: number; border?: string; radius?: string } = {}) => {
		const maxWidth = options.maxWidth ?? 640;
		return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(input.subject || headline)}</title></head><body style="margin:0;padding:24px 12px;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:${maxWidth}px;margin:0 auto;background:#fff;${options.border ? `border:${options.border};` : ""}${options.radius ? `border-radius:${options.radius};` : ""}overflow:hidden"><tbody><tr><td style="padding:32px 28px">${logoMarkup}${inner}</td></tr></tbody></table></body></html>`;
	};

	switch (style) {
		case "minimal":
			return wrap(`${headline ? `<h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#1c2634">${headline}</h1>` : ""}${body}${cta}${signature ? `<p style="margin:24px 0 0;line-height:1.6;color:#344054">${signature}</p>` : ""}<hr style="border:0;border-top:1px solid #eceff3;margin:28px 0 14px">${footerMarkup(brand.footerText, primary)}${socialLinksMarkup(brand.socialLinks, accent)}`, { maxWidth: 560 });
		case "modern":
			return wrap(`<tr><td style="background:${primary};padding:28px 28px 22px;color:#fff">${headline ? `<h1 style="margin:0;font-size:24px;line-height:1.25;color:#fff">${headline}</h1>` : ""}</td></tr><tr><td style="padding:26px 28px">${body}${cta}${signature ? `<p style="margin:24px 0 0;line-height:1.6;color:#344054">${signature}</p>` : ""}<hr style="border:0;border-top:1px solid #eceff3;margin:26px 0 14px">${footerMarkup(brand.footerText, primary)}${socialLinksMarkup(brand.socialLinks, accent)}</td></tr>`, { maxWidth: 640 });
		case "premium":
			return wrap(`<tr><td style="background:#0f172a;padding:34px 28px 26px;text-align:center">${logoMarkup}${headline ? `<h1 style="margin:0;font-size:26px;line-height:1.25;color:#e8edf5;font-family:Georgia,serif">${headline}</h1>` : ""}</td></tr><tr><td style="padding:30px 30px;border-top:3px solid ${accent}">${body}${cta}${signature ? `<p style="margin:26px 0 0;line-height:1.6;color:#344054">${signature}</p>` : ""}<hr style="border:0;border-top:1px solid #eceff3;margin:28px 0 14px">${footerMarkup(brand.footerText, primary)}${socialLinksMarkup(brand.socialLinks, accent)}</td></tr>`, { maxWidth: 620 });
		case "promotional":
			return wrap(`<tr><td style="height:8px;background:${accent}"></td></tr><tr><td style="background:${accent};padding:30px 28px 24px;text-align:center">${logoMarkup}${headline ? `<h1 style="margin:0;font-size:25px;line-height:1.25;color:#fff;font-weight:800">${headline}</h1>` : ""}</td></tr><tr><td style="padding:28px 28px">${body}${cta}${signature ? `<p style="margin:24px 0 0;line-height:1.6;color:#344054">${signature}</p>` : ""}<hr style="border:0;border-top:1px solid #eceff3;margin:26px 0 14px">${footerMarkup(brand.footerText, primary)}${socialLinksMarkup(brand.socialLinks, accent)}</td></tr>`, { maxWidth: 640 });
		case "creative":
			return wrap(`<tr><td style="background:linear-gradient(135deg,${primary},${accent});padding:34px 28px 28px;text-align:center">${logoMarkup}${headline ? `<h1 style="margin:0;font-size:25px;line-height:1.25;color:#fff">${headline}</h1>` : ""}</td></tr><tr><td style="padding:28px 28px">${body}${cta}${signature ? `<p style="margin:24px 0 0;line-height:1.6;color:#344054">${signature}</p>` : ""}<hr style="border:0;border-top:1px solid #eceff3;margin:26px 0 14px">${footerMarkup(brand.footerText, primary)}${socialLinksMarkup(brand.socialLinks, accent)}</td></tr>`, { maxWidth: 640 });
		case "corporate":
		default:
			return wrap(`<tr><td style="border-bottom:3px solid ${primary};padding:26px 28px 18px">${logoMarkup}${headline ? `<h1 style="margin:0;font-size:22px;line-height:1.3;color:${primary}">${headline}</h1>` : ""}</td></tr><tr><td style="padding:28px 28px">${body}${cta}${signature ? `<p style="margin:24px 0 0;line-height:1.6;color:#344054">${signature}</p>` : ""}<hr style="border:0;border-top:1px solid #eceff3;margin:28px 0 14px">${footerMarkup(brand.footerText, primary)}${socialLinksMarkup(brand.socialLinks, accent)}</td></tr>`, { maxWidth: 640, border: "1px solid #e6e9ee" });
	}
}

export function parseBrandColors(value: string | undefined, fallbackPrimary = "#17253a", fallbackAccent = "#ed6a5a") {
	const parts = (value || "").split(/[\s,]+/).filter(Boolean);
	return {
		primary: safeColor(parts[0], fallbackPrimary),
		accent: safeColor(parts[1], fallbackAccent),
	};
}

export function parseSocialLinks(value: unknown): Record<string, string> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	const links: Record<string, string> = {};
	for (const [network, url] of Object.entries(value as Record<string, unknown>)) {
		if (typeof url === "string" && /^(https?:\/\/|mailto:)/i.test(url.trim())) {
			links[network.trim().slice(0, 40)] = url.trim().slice(0, 500);
		}
	}
	return links;
}