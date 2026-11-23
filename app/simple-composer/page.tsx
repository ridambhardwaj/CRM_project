"use client";

import { useState } from "react";
import { Mail, Sparkles, Send, LoaderCircle, Users } from "lucide-react";
type Variant = { subject?: string; body?: string; html?: string };

export default function SimpleComposer() {
	const [prompt, setPrompt] = useState("");
	const [recipients, setRecipients] = useState("");
	const [draft, setDraft] = useState<Variant | null>(null);
	const [editedSubject, setEditedSubject] = useState("");
	const [editedBody, setEditedBody] = useState("");
	const [busy, setBusy] = useState<"generate" | "send" | null>(null);
	const [notice, setNotice] = useState("");
	const [error, setError] = useState("");

	async function generate() {
		const p = prompt.trim();
		if (!p) { setError("Type what you want the email to say."); return; }
		setBusy("generate");
		setError("");
		setNotice("");
		setDraft(null);
		try {
			const response = await fetch("/api/campaigns/assistant", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt: p }),
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(result.error || "Could not generate email.");
			const variants: Variant[] = Array.isArray(result.variants) ? result.variants : [result];
			const v = variants[0];
			setDraft({ subject: v.subject, body: v.body, html: v.html });
			setEditedSubject(v.subject || "");
			setEditedBody(v.body || "");
			setNotice("Email drafted. Edit if needed, add recipients, then send.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not generate email.");
		} finally { setBusy(null); }
	}

	async function send() {
		if (!draft) { setError("Generate an email first."); return; }
		const toList = recipients.split(/[,\s]+/).map((e) => e.trim()).filter(Boolean);
		if (toList.length === 0) { setError("Add at least one recipient email address."); return; }
		setBusy("send");
		setError("");
		setNotice("");

		const subject = editedSubject || draft.subject || "";
		const body = editedBody || draft.body || "";

		// Try server send (Resend). If provider isn't configured, open your email client.
		try {
			const response = await fetch("/api/simple-send", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ to: toList, subject, body, html: draft.html }),
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok) {
				const msg = result.error || "Provider not configured.";
				if (msg.includes("not configured")) {
					openMailClient(toList, subject, body);
					return;
				}
				throw new Error(msg);
			}
			setNotice(`Sent to ${result.sent}/${result.total} recipient${result.total === 1 ? "" : "s"}${result.failed?.length ? ` (${result.failed.length} failed)` : ""}.`);
			setRecipients("");
		} catch (caught) {
			const msg = caught instanceof Error ? caught.message : "Could not send email.";
			if (msg.includes("not configured") || !/^https?:\/\//i.test(window.location.origin || "")) {
				openMailClient(toList, subject, body);
				return;
			}
			setError(msg);
		} finally { setBusy(null); }
	}

	function openMailClient(to: string[], subject: string, body: string) {
		const mailto = `mailto:${to.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
		window.location.href = mailto;
		setNotice("Opening your email client (Outlook / Gmail / default mail app) with the message pre-filled. Click Send there.");
		setRecipients("");
	}

	const disabled = busy !== null || !prompt.trim();
	const canSend = Boolean(draft) && recipients.trim().length > 0 && busy === null;

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-6 flex flex-col gap-2">
				<h2 className="text-2xl font-bold tracking-tight text-[#17253a]">Simple AI Email Composer</h2>
				<p className="text-[#778194]">One prompt generates your email. Pick who to send it to and send.</p>
			</div>

			{error && <div role="alert" className="mb-4 flex items-start gap-2 border-l-2 border-[#d75f52] bg-[#fff5f3] px-3 py-2.5 text-xs text-[#9f463e]">{error}<button aria-label="Dismiss" onClick={() => setError("")} className="ml-auto p-0.5">×</button></div>}
			{notice && <div role="status" className="mb-4 flex items-center gap-2 border-l-2 border-[#4c8664] bg-[#f1f8f3] px-3 py-2.5 text-xs text-[#3d7253]">{notice}<button aria-label="Dismiss" onClick={() => setNotice("")} className="ml-auto p-0.5">×</button></div>}

			<div className="mb-6 rounded-xl border border-[#e7e9ed] bg-white p-5">
				<div className="flex items-center gap-2 mb-3"><Sparkles size={16} className="text-[#ed6a5a]" /><h3 className="text-sm font-bold text-[#17253a]">What should the email say?</h3></div>
				<textarea
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					placeholder="e.g. Write a promotional email for our new digital marketing service, include a CTA to book a call"
					rows={4}
					className="w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] placeholder:text-[#a3aab4] focus:border-[#ed6a5a] resize-y"
				/>
				<div className="mt-3 flex items-center gap-3">
					<button onClick={generate} disabled={disabled} className="inline-flex h-11 items-center justify-center gap-2 bg-[#17253a] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">
						{busy === "generate" ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />} Generate email
					</button>
				</div>
			</div>

			{draft && (
				<div className="mb-6 rounded-xl border border-[#e7e9ed] bg-white p-5">
					<div className="flex items-center gap-2 mb-4"><Mail size={16} className="text-[#ed6a5a]" /><h3 className="text-sm font-bold text-[#17253a]">Your email</h3></div>
					<div className="mb-4">
						<label className="block text-[11px] font-bold text-[#596577] mb-1">Subject</label>
						<input
							value={editedSubject}
							onChange={(e) => setEditedSubject(e.target.value)}
							placeholder="Subject line"
							className="w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a]"
						/>
					</div>
					<div>
						<label className="block text-[11px] font-bold text-[#596577] mb-1">Message</label>
						<textarea
							value={editedBody}
							onChange={(e) => setEditedBody(e.target.value)}
							rows={8}
							className="w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] focus:border-[#ed6a5a] resize-y"
						/>
					</div>
				</div>
			)}

			{draft && (
				<div className="mb-6 rounded-xl border border-[#e7e9ed] bg-white p-5">
					<div className="flex items-center gap-2 mb-3"><Users size={16} className="text-[#ed6a5a]" /><h3 className="text-sm font-bold text-[#17253a]">Who to send to</h3></div>
					<input
						value={recipients}
						onChange={(e) => setRecipients(e.target.value)}
						placeholder="alice@example.com, bob@example.com"
						className="w-full rounded-md border border-[#dfe3e8] bg-white px-3 py-2.5 text-[13px] text-[#253246] placeholder:text-[#a3aab4] focus:border-[#ed6a5a]"
					/>
					<p className="mt-2 text-[11px] text-[#8992a0]">Comma-separated email addresses.</p>
					<div className="mt-4 flex items-center gap-3">
						<button onClick={send} disabled={!canSend} className="inline-flex h-11 items-center justify-center gap-2 bg-[#ed6a5a] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">
							{busy === "send" ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />} Send email
						</button>
					</div>
				</div>
			)}

			<div className="border-t border-[#e7e9ed] pt-5 text-[11px] text-[#8992a0]">
				Sending: if Resend is configured, emails send automatically. Otherwise your default email client (Outlook / Gmail) opens with the message pre-filled — just hit Send there. Only email addresses you explicitly provide are used.
			</div>
		</div>
	);
}
