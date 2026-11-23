"use client";

import { useState, useCallback } from "react";
import {
	Activity, AlertCircle, BarChart3, CalendarClock, Check, Copy, FileText,
	LayoutTemplate, LoaderCircle, Mail, Plus, Send, ShieldCheck, Sparkles,
	Users, WandSparkles, Zap,
} from "lucide-react";

type Category =
	| "Professional" | "Promotion" | "Launch" | "Service introduction"
	| "Sales / lead generation" | "Follow-up" | "Meeting request" | "Offer / discount"
	| "Seasonal greeting" | "Payment reminder" | "Retention" | "Partnership"
	| "Welcome" | "Thank-you";

type Variant = {
	id: string;
	subjectOptions: string[];
	subject: string;
	headline: string;
	body: string;
	ctaText: string;
	ctaUrl: string;
	signature: string;
	html: string;
	edited: boolean;
};

type CampaignStatus = "Draft" | "Approved" | "Sent" | "Failed" | "Cancelled";

type CampaignRecord = {
	id: string;
	name: string;
	category: string;
	status: CampaignStatus;
	recipients: number;
	updatedAt: string;
	subject: string;
};

const categories: Category[] = [
	"Professional", "Promotion", "Launch", "Service introduction", "Sales / lead generation",
	"Follow-up", "Meeting request", "Offer / discount", "Seasonal greeting", "Payment reminder",
	"Retention", "Partnership", "Welcome", "Thank-you",
];

const styles = ["corporate", "minimal", "modern", "premium", "promotional", "creative"] as const;
const tones = [
	"Warm and clear", "Direct and professional", "Friendly and conversational",
	"Confident and concise", "Empathetic and helpful", "Persuasive and energetic",
];

const storageKey = "elestial-campaigns-v1";

function escapeHtml(text: string) {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function safeEmailMarkup(markup: string) {
	if (typeof DOMParser === "undefined") return "";
	const parsed = new DOMParser().parseFromString(`<body>${markup}</body>`, "text/html");
	const allowed = new Set(["A", "B", "BLOCKQUOTE", "BR", "DIV", "EM", "H1", "H2", "H3", "HR", "I", "LI", "OL", "P", "SPAN", "STRONG", "TABLE", "TBODY", "TD", "TH", "THEAD", "TR", "UL", "IMG"]);
	const discarded = new Set(["IFRAME", "OBJECT", "SCRIPT", "STYLE", "SVG", "FORM", "VIDEO", "AUDIO"]);
	function clean(node: Node): Node | null {
		if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || "");
		if (!(node instanceof Element)) return null;
		if (discarded.has(node.tagName)) return null;
		const children = Array.from(node.childNodes).map(clean).filter((child): child is Node => child !== null);
		if (!allowed.has(node.tagName)) {
			const fragment = document.createDocumentFragment();
			children.forEach((child) => fragment.appendChild(child));
			return fragment;
		}
		const element = document.createElement(node.tagName.toLowerCase());
		if (node.tagName === "A") {
			const href = node.getAttribute("href")?.trim() || "";
			if (/^(https?:\/\/|mailto:)/i.test(href)) element.setAttribute("href", href);
		}
		if (node.tagName === "IMG") {
			const src = node.getAttribute("src")?.trim() || "";
			if (/^https:\/\//i.test(src)) element.setAttribute("src", src);
		}
		children.forEach((child) => element.appendChild(child));
		return element;
	}
	const output = document.createElement("div");
	Array.from(parsed.body.childNodes).forEach((node) => {
		const cleaned = clean(node);
		if (cleaned) output.appendChild(cleaned);
	});
	return output.innerHTML;
}

function previewDocument(markup: string) {
	return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;padding:24px;color:#253246;font:14px/1.65 Arial,sans-serif}h1{font-size:22px;line-height:1.25}h2{font-size:16px;border-bottom:1px solid #e6e9ee;padding-bottom:12px}p{margin:12px 0}a{color:#b94f45}</style></head><body>${markup}</body></html>`;
}

function makeVariant(value: Record<string, unknown>, index: number): Variant {
	const subjects = Array.isArray(value.subjectOptions) ? value.subjectOptions.filter((item): item is string => typeof item === "string") : [];
	const subject = subjects[0] || (typeof value.subject === "string" ? value.subject : "");
	return {
		id: `variant-${index + 1}`,
		subjectOptions: subjects.length ? subjects : [subject],
		subject,
		headline: typeof value.headline === "string" ? value.headline : "",
		body: typeof value.body === "string" ? value.body : "",
		ctaText: typeof value.ctaText === "string" ? value.ctaText : "",
		ctaUrl: typeof value.ctaUrl === "string" ? value.ctaUrl : "",
		signature: typeof value.signature === "string" ? value.signature : "",
		html: typeof value.html === "string" ? value.html : "",
		edited: false,
	};
}

function campaignStatusLabel(status: string): CampaignStatus {
	if (status === "needs_approval") return "Approved";
	if (status === "approved") return "Approved";
	if (status === "scheduled") return "Approved";
	if (status === "sent") return "Sent";
	if (status === "failed") return "Failed";
	if (status === "cancelled") return "Cancelled";
	return "Draft";
}

export default function CampaignsPage() {
	const [tab, setTab] = useState<"composer" | "campaigns" | "analytics">("composer");
	const [brief, setBrief] = useState("");
	const [category, setCategory] = useState<Category>("Professional");
	const [productFacts, setProductFacts] = useState("");
	const [audience, setAudience] = useState("");
	const [objective, setObjective] = useState("");
	const [personalization, setPersonalization] = useState("");
	const [tone, setTone] = useState("Warm and clear");
	const [style, setStyle] = useState("corporate");
	const [brandColors, setBrandColors] = useState("#17253a, #ed6a5a");
	const [ctaInfo, setCtaInfo] = useState("");
	const [variationCount, setVariationCount] = useState(3);
	const [variants, setVariants] = useState<Variant[]>([]);
	const [activeVariant, setActiveVariant] = useState(0);
	const [busy, setBusy] = useState<"generate" | "send" | null>(null);
	const [notice, setNotice] = useState("");
	const [error, setError] = useState("");

	const [records, setRecords] = useState<CampaignRecord[]>(() => {
		try {
			const raw = typeof localStorage !== "undefined" ? localStorage.getItem(storageKey) : null;
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch { return []; }
	});

	const active = variants[activeVariant];
	const currentMarkup = active ? (active.edited ? active.html || active.body : active.html || active.body) : "";
	const sanitizedMarkup = safeEmailMarkup(currentMarkup || "<p>Your reviewed email preview appears here.</p>");
	const iframeDoc = previewDocument(sanitizedMarkup);

	const persistRecords = useCallback((next: CampaignRecord[]) => {
		setRecords(next);
		try {
			if (typeof localStorage !== "undefined") localStorage.setItem(storageKey, JSON.stringify(next));
		} catch { /* noop */ }
	}, []);

	const api = useCallback(async (path: string, init?: RequestInit) => {
		const headers = new Headers(init?.headers);
		if (init?.body) headers.set("Content-Type", "application/json");
		const response = await fetch(path, { ...init, headers });
		const result = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(result.error || "Request failed.");
		return result;
	}, []);

	async function generateDraft() {
		const p = brief.trim();
		if (p.length < 8) { setError("Type a brief of at least 8 characters."); return; }
		setBusy("generate");
		setError("");
		setNotice("");
		try {
			const response = await fetch("/api/campaigns/assistant", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt: p }),
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(result.error || "Could not generate email.");
			const received = (Array.isArray(result.variants) ? result.variants : []).map((v: Record<string, unknown>, i: number) => makeVariant(v, i));
			if (!received.length) throw new Error("No variants generated.");
			setVariants(received);
			setActiveVariant(0);
			setNotice(`${received.length} variant${received.length === 1 ? "" : "s"} generated.`);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not generate email.");
		} finally { setBusy(null); }
	}

	async function saveCampaign(status: CampaignStatus) {
		if (!active?.subject.trim() || !active.body.trim()) { setError("Add a subject and message before saving."); return; }
		const record: CampaignRecord = {
			id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
			name: active.subject.trim(), category, status,
			recipients: 0,
			updatedAt: new Date().toISOString(),
			subject: active.subject,
		};
		persistRecords([record, ...records]);
		setNotice(`${status} campaign saved locally.`);
		setTab("campaigns");
	}

	async function sendCampaign() {
		if (!active) { setError("Generate an email first."); return; }
		const toList = audience.split(/[,\s]+/).map((e) => e.trim()).filter(Boolean);
		if (toList.length === 0) { setError("Add recipient email addresses."); return; }
		setBusy("send");
		setError("");
		setNotice("");
		try {
			const response = await fetch("/api/simple-send", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					to: toList,
					subject: active.subject,
					body: active.body,
					html: active.html,
				}),
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(result.error || "Could not send email.");
			persistRecords(records.map((r) => r.id === (active as any).id ? { ...r, status: "Sent" } : r));
			setNotice(`Sent to ${result.sent}/${result.total} recipient${result.total === 1 ? "" : "s"}${result.failed?.length ? ` (${result.failed.length} failed)` : ""}.`);
			setTab("campaigns");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not send email.");
		} finally { setBusy(null); }
	}

	function updateActive(changes: Partial<Variant>) {
		setVariants((current) => current.map((v, i) => i === activeVariant ? { ...v, ...changes, edited: true } : v));
	}

	const navItems = [
		{ id: "composer" as const, label: "AI Composer", icon: Sparkles },
		{ id: "campaigns" as const, label: "Campaigns", icon: Mail },
		{ id: "analytics" as const, label: "Analytics", icon: BarChart3 },
	];

	return (
		<div className="mx-auto max-w-[1440px]">
			<div className="mb-5 flex flex-col justify-between gap-4 border-b border-[#e4e8ed] pb-5 sm:flex-row sm:items-end">
				<div>
					<div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#d75f52]"><Sparkles size={14} /> AI campaign composer</div>
					<h2 className="mt-1 text-[23px] font-bold tracking-tight text-[#17253a]">Campaign composer</h2>
					<p className="mt-1 text-[13px] text-[#778194]">Generate emails with one prompt. No tokens required.</p>
				</div>
				<div className="flex gap-2">
					<button onClick={() => setTab("composer")} className={`inline-flex h-9 items-center gap-1.5 bg-[#17253a] px-3 text-[11px] font-bold text-white ${tab === "composer" ? "" : "opacity-60"}`}>
						<Plus size={13} /> New email
					</button>
				</div>
			</div>

			<nav aria-label="Campaign sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-[#e5e8ed]">
				{navItems.map((item) => {
					const Icon = item.icon;
					return (
						<button key={item.id} onClick={() => setTab(item.id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-bold transition ${tab === item.id ? "border-[#ed6a5a] text-[#17253a]" : "border-transparent text-[#8992a0] hover:text-[#455267]"}`} aria-current={tab === item.id ? "page" : undefined}>
							<Icon size={15} />{item.label}
						</button>
					);
				})}
			</nav>

			{error && <div role="alert" className="mb-4 flex items-start gap-2 border-l-2 border-[#d75f52] bg-[#fff5f3] px-3 py-2.5 text-xs text-[#9f463e]">{error}<button aria-label="Dismiss" onClick={() => setError("")} className="ml-auto p-0.5">×</button></div>}
			{notice && <div role="status" className="mb-4 flex items-center gap-2 border-l-2 border-[#4c8664] bg-[#f1f8f3] px-3 py-2.5 text-xs text-[#3d7253]">{notice}<button aria-label="Dismiss" onClick={() => setNotice("")} className="ml-auto p-0.5">×</button></div>}

			{tab === "composer" && (
				<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.04fr)_minmax(380px,.96fr)]">
					<section className="min-w-0 space-y-4">
						<div className="border border-[#e3e7ec] bg-white">
							<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f3] px-4 py-3">
								<div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center bg-[#fff0ec] text-[#d75f52]"><WandSparkles size={16} /></span><div><h3 className="text-[13px] font-bold">Campaign brief</h3><p className="text-[10px] text-[#8b93a0]">One prompt generates your email</p></div></div>
								<label className="flex items-center gap-2 text-[10px] font-semibold text-[#687487]">Category
									<select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="h-8 max-w-[190px] rounded-md border border-[#dfe3e8] bg-white px-2 text-[11px] text-[#263246]">
										{categories.map((c) => <option key={c}>{c}</option>)}
									</select>
								</label>
							</div>
							<div className="space-y-3.5 p-4">
								<div>
									<label htmlFor="brief" className="block text-[11px] font-bold text-[#596577] mb-1">Natural-language brief <span className="font-medium text-[#929aaa]">· required</span></label>
									<textarea id="brief" value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={2000} rows={3} placeholder="e.g. Write a promotional email for our digital marketing services" className="mt-1 w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] placeholder:text-[#a3aab4] focus:border-[#ed6a5a] resize-y" />
									<div className="mt-1 flex justify-end text-[10px] text-[#9aa1ab]">{brief.length}/2,000</div>
								</div>
								<div className="grid gap-3 sm:grid-cols-2">
									<div><label htmlFor="facts" className="block text-[11px] font-bold text-[#596577] mb-1">Product / service facts</label><textarea id="facts" value={productFacts} onChange={(e) => setProductFacts(e.target.value)} rows={2} placeholder="Confirmed benefits, pricing" className="mt-1 w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a] resize-y" /></div>
									<div><label htmlFor="aud" className="block text-[11px] font-bold text-[#596577] mb-1">Recipient emails</label><input id="aud" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="alice@example.com, bob@example.com" className="mt-1 w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a]" /></div>
									<div><label htmlFor="obj" className="block text-[11px] font-bold text-[#596577] mb-1">Objective</label><input id="obj" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="e.g. Book a call" className="mt-1 w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a]" /></div>
									<div><label htmlFor="pers" className="block text-[11px] font-bold text-[#596577] mb-1">Personalization context</label><input id="pers" value={personalization} onChange={(e) => setPersonalization(e.target.value)} placeholder="Known needs" className="mt-1 w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a]" /></div>
								</div>
								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
									<div><label htmlFor="tone" className="block text-[11px] font-bold text-[#596577] mb-1">Tone</label><select id="tone" value={tone} onChange={(e) => setTone(e.target.value)} className="mt-1 w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a]">{tones.map((t) => <option key={t}>{t}</option>)}</select></div>
									<div><label htmlFor="style" className="block text-[11px] font-bold text-[#596577] mb-1">Style</label><select id="style" value={style} onChange={(e) => setStyle(e.target.value)} className="mt-1 w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a]">{styles.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
									<div><label htmlFor="colors" className="block text-[11px] font-bold text-[#596577] mb-1">Brand colors</label><input id="colors" value={brandColors} onChange={(e) => setBrandColors(e.target.value)} placeholder="#17253a, #ed6a5a" className="mt-1 w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a]" /></div>
									<div><label htmlFor="cta" className="block text-[11px] font-bold text-[#596577] mb-1">CTA / contact</label><input id="cta" value={ctaInfo} onChange={(e) => setCtaInfo(e.target.value)} placeholder="https://book-call.com" className="mt-1 w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a]" /></div>
								</div>
								<div className="flex flex-col gap-3 border-t border-[#edf0f3] pt-3 sm:flex-row sm:items-end sm:justify-between">
									<label className="block w-[130px] text-[11px] font-bold text-[#596577]">Variants<select value={variationCount} onChange={(e) => setVariationCount(Number(e.target.value))} className="mt-1 w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a]"><option value={1}>1 version</option><option value={2}>2 versions</option><option value={3}>3 versions</option><option value={4}>4 versions</option></select></label>
									<div className="flex items-center gap-2"><span className="text-[10px] text-[#929aaa]">No token needed · free</span></div>
								</div>
								<div className="flex flex-wrap items-center gap-2 pt-1">
									<button onClick={generateDraft} disabled={busy !== null || brief.trim().length < 8} className="inline-flex h-10 items-center gap-2 bg-[#17253a] px-4 text-xs font-bold text-white transition hover:bg-[#25364d] disabled:cursor-not-allowed disabled:opacity-45">
										{busy === "generate" ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />} {busy === "generate" ? "Generating…" : `Generate ${variationCount} variant${variationCount === 1 ? "" : "s"}`}
									</button>
								</div>
							</div>
						</div>

						<div className="border border-[#e3e7ec] bg-white">
							<div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf0f3] px-4 py-3">
								<div><h3 className="text-[13px] font-bold">Review & edit</h3><p className="mt-0.5 text-[10px] text-[#8b93a0]">Edit freely before saving or sending.</p></div>
							</div>
							{variants.length > 0 && active ? (
								<div className="space-y-4">
									<div className="flex gap-2 overflow-x-auto border-b border-[#edf0f3] px-4 py-2">
										{variants.map((variant, index) => (
											<button key={variant.id} onClick={() => setActiveVariant(index)} className={`shrink-0 border px-2.5 py-1.5 text-[10px] font-bold ${activeVariant === index ? "border-[#e5b3ac] bg-[#fff5f3] text-[#b84f45]" : "border-[#e5e8ec] text-[#687487]"}`}>Variant {index + 1}</button>
										))}
									</div>
									<div className="space-y-3 p-4">
										<div>
											<label htmlFor="subject" className="block text-[11px] font-bold text-[#596577] mb-1">Subject line</label>
											<input id="subject" value={active.subject} onChange={(e) => updateActive({ subject: e.target.value })} maxLength={160} className="w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a]" />
											{active.subjectOptions.length > 1 && <div className="mt-2 flex flex-wrap gap-1.5">{active.subjectOptions.map((option, index) => <button key={`${option}-${index}`} onClick={() => updateActive({ subject: option })} className="border border-[#e4e7ec] px-2 py-1 text-[10px] text-[#687487] hover:border-[#ed6a5a]">{option}</button>)}</div>}
										</div>
										{active.headline && <div><label htmlFor="headline" className="block text-[11px] font-bold text-[#596577] mb-1">Headline</label><input id="headline" value={active.headline} onChange={(e) => updateActive({ headline: e.target.value })} className="w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a]" /></div>}
										<div><label htmlFor="body" className="block text-[11px] font-bold text-[#596577] mb-1">Email body</label><textarea id="body" value={active.body} onChange={(e) => updateActive({ body: e.target.value })} maxLength={8000} rows={7} className="w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a] resize-y" /><div className="mt-1 text-right text-[10px] text-[#9aa1ab]">{active.body.length}/8,000</div></div>
										<div className="grid gap-3 sm:grid-cols-2">
											<div><label htmlFor="ctaText" className="block text-[11px] font-bold text-[#596577] mb-1">Call to action</label><input id="ctaText" value={active.ctaText} onChange={(e) => updateActive({ ctaText: e.target.value })} className="w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a]" /></div>
											<div><label htmlFor="ctaUrl" className="block text-[11px] font-bold text-[#596577] mb-1">CTA URL</label><input id="ctaUrl" value={active.ctaUrl} onChange={(e) => updateActive({ ctaUrl: e.target.value })} className="w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a]" /></div>
										</div>
										{active.signature && <div><label htmlFor="sig" className="block text-[11px] font-bold text-[#596577] mb-1">Signature</label><input id="sig" value={active.signature} onChange={(e) => updateActive({ signature: e.target.value })} className="w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a]" /></div>}
									</div>
									<div className="flex flex-wrap items-center gap-2 pt-3">
										<button onClick={() => saveCampaign("Draft")} disabled={busy !== null} className="h-9 border border-[#dfe3e8] px-3 text-[11px] font-bold text-[#485568] disabled:opacity-45">Save draft</button>
										<button onClick={() => saveCampaign("Approved")} disabled={busy !== null} className="h-9 border border-[#dfe3e8] px-3 text-[11px] font-bold text-[#485568] disabled:opacity-45">Approve</button>
										<button onClick={sendCampaign} disabled={busy !== null || !audience.trim()} className="inline-flex h-9 items-center gap-1.5 bg-[#ed6a5a] px-3 text-[11px] font-bold text-white disabled:opacity-45">
											{busy === "send" ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />} Send email
										</button>
									</div>
								</div>
							) : (
								<div className="grid min-h-[200px] place-items-center px-6 py-10 text-center"><div><span className="mx-auto grid h-10 w-10 place-items-center bg-[#f3f5f7] text-[#8490a0]"><FileText size={18} /></span><p className="mt-3 text-xs font-bold text-[#455267]">Your variants will appear here</p><p className="mt-1 max-w-[300px] text-[11px] leading-5 text-[#8992a0]">Add a brief and generate copy.</p></div></div>
							)}
						</div>

						<div className="border border-[#e3e7ec] bg-white">
							<div className="flex items-center justify-between border-b border-[#edf0f3] px-4 py-3"><div><h3 className="text-[13px] font-bold">Email preview</h3><p className="mt-0.5 text-[10px] text-[#8b93a0]">Sandboxed HTML</p></div></div>
							<div className="bg-[#f3f5f7] p-3 sm:p-5">
								<div className="mx-auto max-w-[560px] overflow-hidden border border-[#e2e6eb] bg-white shadow-sm">
									<div className="flex h-9 items-center gap-1.5 border-b border-[#edf0f3] px-3"><span className="h-2 w-2 rounded-full bg-[#ed6a5a]" /><span className="h-2 w-2 rounded-full bg-[#e7bd72]" /><span className="h-2 w-2 rounded-full bg-[#7ba989]" /><span className="ml-2 truncate text-[9px] text-[#99a1ad]">{active?.subject || "Campaign preview"}</span></div>
									<iframe title="Email preview" sandbox="" referrerPolicy="no-referrer" srcDoc={iframeDoc} className="h-[370px] w-full bg-white" />
								</div>
							</div>
						</div>
					</section>
				</div>
			)}

			{tab === "campaigns" && (
				<section className="border border-[#e3e7ec] bg-white">
					<div className="flex flex-col justify-between gap-3 border-b border-[#edf0f3] px-4 py-4 sm:flex-row sm:items-center">
						<div><h3 className="text-[14px] font-bold">Campaign records</h3><p className="mt-1 text-[11px] text-[#8b93a0]">Saved locally in your browser.</p></div>
						<button onClick={() => setTab("composer")} className="inline-flex h-9 items-center justify-center gap-1.5 bg-[#17253a] px-3 text-[11px] font-bold text-white"><Plus size={14} />New campaign</button>
					</div>
					{records.length ? (
						<div className="overflow-x-auto">
							<table className="w-full min-w-[720px] text-left">
								<thead className="bg-[#fafbfc] text-[10px] uppercase tracking-wide text-[#8992a0]"><tr><th className="px-4 py-3 font-bold">Campaign</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 font-bold">Category</th><th className="px-4 py-3 font-bold">Updated</th><th className="px-4 py-3 font-bold">Action</th></tr></thead>
								<tbody className="divide-y divide-[#edf0f3]">
									{records.map((record) => (
										<tr key={record.id} className="hover:bg-[#fcfcfd]">
											<td className="max-w-[340px] px-4 py-3"><p className="truncate text-xs font-bold text-[#273347]">{record.name}</p><p className="mt-1 text-[10px] text-[#8992a0]">{record.subject.slice(0, 60)}</p></td>
											<td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${record.status === "Approved" ? "text-[#4d805f]" : record.status === "Sent" ? "text-[#4d805f]" : "text-[#687487]"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{record.status}</span></td>
											<td className="px-4 py-3 text-xs text-[#657286]">{record.category}</td>
											<td className="px-4 py-3 text-[10px] text-[#8992a0]">{new Date(record.updatedAt).toLocaleString()}</td>
											<td className="px-4 py-3">
												<div className="flex gap-1">
													{record.status === "Draft" && <button onClick={() => setTab("composer")} className="h-7 border border-[#dfe3e8] px-2 text-[10px] font-bold">Edit</button>}
													<button onClick={() => persistRecords(records.filter((r) => r.id !== record.id))} className="h-7 border border-[#dfe3e8] px-2 text-[10px] font-bold text-[#9d5149]">Delete</button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<div className="grid min-h-[230px] place-items-center px-6 py-10 text-center"><div><Mail size={23} className="mx-auto text-[#a0a8b3]" /><p className="mt-3 text-xs font-bold">No campaigns yet</p><p className="mt-1 text-[11px] text-[#8992a0]">Generate your first campaign in the composer.</p></div></div>
					)}
				</section>
			)}

			{tab === "analytics" && (
				<section className="border border-[#e3e7ec] bg-white">
					<div className="border-b border-[#edf0f3] px-4 py-4"><h3 className="text-[14px] font-bold">Analytics</h3><p className="mt-1 text-[11px] text-[#8b93a0]">Provider-verified metrics require an email provider connection.</p></div>
					<div className="grid gap-px bg-[#edf0f3] sm:grid-cols-4 p-4">
						{[{ label: "Sent", value: records.filter((r) => r.status === "Sent").length, note: "Local records" }, { label: "Approved", value: records.filter((r) => r.status === "Approved").length, note: "Local records" }, { label: "Drafts", value: records.filter((r) => r.status === "Draft").length, note: "Local records" }, { label: "Total", value: records.length, note: "Local records" }].map((metric) => (
							<div key={metric.label} className="bg-white px-4 py-5"><p className="text-[10px] font-semibold uppercase tracking-wide text-[#8992a0]">{metric.label}</p><p className="mt-2 text-2xl font-bold text-[#263246]">{metric.value}</p><p className="mt-1 text-[10px] text-[#8992a0]">{metric.note}</p></div>
						))}
					</div>
				</section>
			)}
		</div>
	);
}
