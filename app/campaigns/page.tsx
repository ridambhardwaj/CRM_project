"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Check, CheckCheck, LoaderCircle, Mail, Send, Sparkles, Users } from "lucide-react";
import { demoContacts } from "@/app/lib/demo-contacts";

type Draft = { subject: string; body: string };

export default function CampaignsPage() {
	const [prompt, setPrompt] = useState("");
	const [draft, setDraft] = useState<Draft>({ subject: "", body: "" });
	const [selectedIds, setSelectedIds] = useState(demoContacts.map((contact) => contact.id));
	const [sendToken, setSendToken] = useState("");
	const [consentConfirmed, setConsentConfirmed] = useState(false);
	const [busy, setBusy] = useState<"draft" | "send" | null>(null);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const selectedContacts = useMemo(() => demoContacts.filter((contact) => selectedIds.includes(contact.id)), [selectedIds]);

	async function generateDraft() {
		setBusy("draft");
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/campaigns/draft", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Could not generate a draft.");
			setDraft({ subject: result.subject, body: result.body });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not generate a draft.");
		} finally {
			setBusy(null);
		}
	}

	async function sendCampaign() {
		setBusy("send");
		setError("");
		setMessage("");
		try {
			const response = await fetch("/api/campaigns/send", {
				method: "POST",
				headers: { "Content-Type": "application/json", "x-campaign-token": sendToken },
				body: JSON.stringify({
					contactIds: selectedIds,
					subject: draft.subject,
					body: draft.body,
					consentConfirmed,
				}),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Could not send this campaign.");
			setMessage(`${result.sent} email${result.sent === 1 ? "" : "s"} sent${result.failed.length ? `; ${result.failed.length} failed` : ""}.`);
			if (result.failed.length) setError(`Delivery failed for: ${result.failed.join(", ")}`);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not send this campaign.");
		} finally {
			setBusy(null);
		}
	}

	function toggleAll() {
		setSelectedIds(selectedIds.length === demoContacts.length ? [] : demoContacts.map((contact) => contact.id));
	}

	return (
		<div className="mx-auto max-w-[1320px]">
			<div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
				<div>
					<p className="text-xs font-bold uppercase tracking-[.12em] text-[#ed6a5a]">Campaign studio</p>
					<h2 className="mt-1 text-2xl font-bold">AI email agent</h2>
					<p className="mt-1 text-sm text-[#778194]">Describe the offer once. Review the draft, then send it to your selected contacts.</p>
				</div>
				<div className="flex items-center gap-2 text-xs font-semibold text-[#657286]"><Users size={16}/>{selectedContacts.length} of {demoContacts.length} contacts selected</div>
			</div>

			<div className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
				<section className="space-y-5">
					<div className="rounded-xl border border-[#e7e9ed] bg-white p-5 md:p-6">
						<div className="flex items-center gap-3">
							<span className="grid h-10 w-10 place-items-center rounded-lg bg-[#fff0ec] text-[#e66757]"><Sparkles size={19}/></span>
							<div><h3 className="text-sm font-bold">Campaign brief</h3><p className="mt-0.5 text-xs text-[#8b93a0]">One prompt becomes a personalized email</p></div>
						</div>
						<label className="mt-5 block text-xs font-bold" htmlFor="campaign-prompt">What should the email say?</label>
						<textarea id="campaign-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={2000} rows={5} placeholder="Introduce our year-end analytics offer to existing customers. Keep it warm and concise, mention the free consultation, and invite them to book a call." className="mt-2 w-full resize-y rounded-lg border border-[#dfe3e8] px-3.5 py-3 text-sm leading-6 placeholder:text-[#a3aab4]"/>
						<div className="mt-2 flex items-center justify-between text-[11px] text-[#949ca8]"><span>Be specific about the offer, audience, tone, and call to action.</span><span>{prompt.length}/2,000</span></div>
						<button disabled={busy !== null || prompt.trim().length < 8} onClick={generateDraft} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg bg-[#17253a] px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">
							{busy === "draft" ? <LoaderCircle size={15} className="animate-spin"/> : <Sparkles size={15}/>}Generate draft
						</button>
					</div>

					<div className="overflow-hidden rounded-xl border border-[#e7e9ed] bg-white">
						<div className="flex items-center justify-between border-b border-[#edf0f3] px-5 py-4">
							<div><h3 className="text-sm font-bold">Recipients</h3><p className="mt-0.5 text-xs text-[#8b93a0]">CRM demo contacts</p></div>
							<button onClick={toggleAll} className="text-xs font-bold text-[#d75f52]">{selectedIds.length === demoContacts.length ? "Clear all" : "Select all"}</button>
						</div>
						<div className="max-h-[300px] overflow-y-auto">
							{demoContacts.map((contact) => <label key={contact.id} className="flex cursor-pointer items-center gap-3 border-b border-[#f0f1f3] px-5 py-3 last:border-0 hover:bg-[#fafbfc]">
								<input type="checkbox" checked={selectedIds.includes(contact.id)} onChange={() => setSelectedIds((current) => current.includes(contact.id) ? current.filter((id) => id !== contact.id) : [...current, contact.id])} className="h-4 w-4 accent-[#ed6a5a]"/>
								<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#edf2f7] text-[10px] font-bold text-[#657286]">{contact.name.split(" ").map((part) => part[0]).join("")}</span>
								<span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{contact.name} <span className="font-medium text-[#929aaa]">· {contact.company}</span></span><span className="mt-0.5 block truncate text-[11px] text-[#929aaa]">{contact.email}</span></span>
							</label>)}
						</div>
					</div>
				</section>

				<section className="rounded-xl border border-[#e7e9ed] bg-white p-5 md:p-6">
					<div className="flex items-center gap-3 border-b border-[#edf0f3] pb-4">
						<span className="grid h-10 w-10 place-items-center rounded-lg bg-[#edf7f1] text-[#528364]"><Mail size={18}/></span>
						<div><h3 className="text-sm font-bold">Review and send</h3><p className="mt-0.5 text-xs text-[#8b93a0]">Personalized to each recipient at send time</p></div>
					</div>
					<label className="mt-5 block text-xs font-bold" htmlFor="email-subject">Subject</label>
					<input id="email-subject" value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} maxLength={160} placeholder="Your subject line" className="mt-2 h-10 w-full rounded-lg border border-[#dfe3e8] px-3 text-sm"/>
					<label className="mt-4 block text-xs font-bold" htmlFor="email-body">Message</label>
					<textarea id="email-body" value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} maxLength={8000} rows={10} placeholder="Generate a draft or write your email here. Use {{first_name}} to personalize the greeting." className="mt-2 w-full resize-y rounded-lg border border-[#dfe3e8] px-3 py-3 text-sm leading-6 placeholder:text-[#a3aab4]"/>
					<p className="mt-2 text-[11px] text-[#929aaa]">Preview for {selectedContacts[0]?.name ?? "no recipient selected"}: {draft.body.replaceAll("{{first_name}}", selectedContacts[0]?.name.split(" ")[0] ?? "there").split("\n")[0] || "Your message will appear here."}</p>

					<div className="mt-5 rounded-lg border border-[#f0d7b6] bg-[#fffaf2] p-3.5">
						<label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-[#6d5a41]"><input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#d58b39]"/><span>I confirm each selected contact has consented to receive promotional email and that this campaign complies with applicable email laws.</span></label>
						<label className="mt-3 block text-[11px] font-bold text-[#6d5a41]" htmlFor="send-token">Operator send token</label>
						<input id="send-token" type="password" autoComplete="off" value={sendToken} onChange={(event) => setSendToken(event.target.value)} placeholder="Configured by your administrator" className="mt-1.5 h-9 w-full rounded-md border border-[#e8d8c3] bg-white px-3 text-xs"/>
					</div>
					{error && <p role="alert" className="mt-3 flex items-start gap-2 text-xs text-[#bd4c42]"><AlertCircle size={15} className="mt-0.5 shrink-0"/>{error}</p>}
					{message && <p role="status" className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#42805a]"><Check size={15}/>{message}</p>}
					<button disabled={busy !== null || !draft.subject.trim() || !draft.body.trim() || !selectedIds.length || !consentConfirmed || !sendToken} onClick={sendCampaign} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#ed6a5a] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">
						{busy === "send" ? <LoaderCircle size={16} className="animate-spin"/> : <Send size={16}/>}Send to {selectedContacts.length} contact{selectedContacts.length === 1 ? "" : "s"}
					</button>
					<div className="mt-4 flex items-start gap-2 border-t border-[#edf0f3] pt-4 text-[11px] leading-5 text-[#8992a0]"><CheckCheck size={15} className="mt-0.5 shrink-0"/>Each message is sent separately. Recipients are limited to the CRM demo contact list; connect your CRM database before using this for a real audience.</div>
				</section>
			</div>
		</div>
	);
}