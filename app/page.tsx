"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ChevronRight, Plus, TrendingUp, Users, WalletCards, Target, CalendarClock } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const revenue = [
	{ m: "May", value: 42 },
	{ m: "Jun", value: 48 },
	{ m: "Jul", value: 45 },
	{ m: "Aug", value: 58 },
	{ m: "Sep", value: 54 },
	{ m: "Oct", value: 67 },
	{ m: "Nov", value: 74 },
];

export default function Home() {
	const [modal, setModal] = useState(false);
	return (
		<div className="mx-auto max-w-[1500px]">
			<div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
				<div>
					<p className="text-xs font-semibold text-[#8b94a3]">FRIDAY, NOVEMBER 20</p>
					<h2 className="mt-1 text-2xl font-bold tracking-tight text-[#17253a]">Good morning, Maya</h2>
					<p className="mt-1 text-sm text-[#778194]">Here’s what’s happening with your pipeline today.</p>
				</div>
				<button
					onClick={() => setModal(true)}
					className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#ed6a5a] px-4 text-sm font-bold text-white shadow-[0_6px_18px_rgba(237,106,90,.18)] hover:bg-[#df5d4d]"
				>
					<Plus size={17} /> Add lead
				</button>
			</div>

			<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{[
					["Total pipeline", "$284,500", "+12.5%", "from last month", WalletCards, "#fff4ed"],
					["Closed revenue", "$92,840", "+8.2%", "from last month", TrendingUp, "#edf7f1"],
					["Active leads", "248", "+18", "new this month", Users, "#edf2fb"],
					["Win rate", "64.2%", "+4.1%", "from last month", Target, "#f8edf1"],
				].map(([label, value, change, note, Icon, bg]) => (
					<article
						key={String(label)}
						className="rounded-xl border border-[#e7e9ed] bg-white p-5 shadow-[0_3px_12px_rgba(23,37,58,.025)]"
					>
						<div className="flex items-start justify-between">
							<div>
								<p className="text-xs font-semibold text-[#858e9d]">{String(label)}</p>
								<p className="mt-3 text-[26px] font-bold tracking-tight">{String(value)}</p>
							</div>
							<span
								className="grid h-10 w-10 place-items-center rounded-lg"
								style={{ background: String(bg) }}
							>
								<Icon size={18} className="text-[#566173]" />
							</span>
						</div>
						<p className="mt-3 flex items-center gap-1 text-xs">
							<span className="font-bold text-[#43a36f]">{String(change)}</span>
							<span className="text-[#9aa1ad]">{String(note)}</span>
						</p>
					</article>
				))}
			</section>

			<section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,.72fr)]">
				<article className="min-w-0 rounded-xl border border-[#e7e9ed] bg-white p-5">
					<div className="mb-4 flex items-center justify-between">
						<div>
							<h3 className="text-sm font-bold">Revenue overview</h3>
							<p className="mt-1 text-xs text-[#949baa]">Closed revenue over time</p>
						</div>
						<button className="rounded-lg border border-[#e4e7ec] px-3 py-2 text-xs font-semibold">
							Last 7 months
						</button>
					</div>
					<div className="h-[260px]">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart
								data={revenue}
								margin={{ top: 10, right: 5, left: -20, bottom: 0 }}
							>
								<defs>
									<linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#ed6a5a" stopOpacity={0.24} />
										<stop offset="95%" stopColor="#ed6a5a" stopOpacity={0} />
									</linearGradient>
								</defs>
								<CartesianGrid vertical={false} stroke="#eef0f3" />
								<XAxis
									dataKey="m"
									axisLine={false}
									tickLine={false}
									tick={{ fontSize: 11, fill: "#969daa" }}
								/>
								<YAxis
									axisLine={false}
									tickLine={false}
									tick={{ fontSize: 11, fill: "#969daa" }}
									tickFormatter={(v) => `$${v}k`}
								/>
								<Tooltip />
								<Area
									type="monotone"
									dataKey="value"
									stroke="#ed6a5a"
									strokeWidth={2.5}
									fill="url(#colorRevenue)"
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</article>
				<article className="rounded-xl border border-[#e7e9ed] bg-white p-5">
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-bold">Pipeline</h3>
						<Link
							href="/pipeline"
							className="text-xs font-bold text-[#ed6a5a]"
						>
							View board
						</Link>
					</div>
					{[
						["New", "42", "$68,400", "#d6dff0", 42],
						["Qualified", "38", "$86,200", "#9db7de", 58],
						["Proposal", "24", "$72,000", "#ed9d8d", 72],
						["Negotiation", "16", "$58,000", "#ed6a5a", 88],
						["Won", "31", "$92,840", "#58a77d", 100],
					].map(([name, count, value, color, width]) => (
						<div key={String(name)} className="mt-5">
							<div className="mb-2 flex items-center justify-between text-xs">
								<span className="font-semibold">{String(name)}</span>
								<span className="text-[#929aaa]">
									<b className="text-[#263247]">{String(count)}</b> ·{" "}
									{String(value)}
								</span>
							</div>
							<div className="h-1.5 rounded-full bg-[#eff1f4]">
								<div
									className="h-full rounded-full"
									style={{ width: `${width}%`, background: String(color) }}
								/>
							</div>
						</div>
					))}
				</article>
			</section>

			<section className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_1fr_.72fr]">
				<article className="rounded-xl border border-[#e7e9ed] bg-white p-5">
					<h3 className="text-sm font-bold">Recent activity</h3>
					<div className="mt-4 space-y-4">
						{[
							["JD", "Deal moved to Proposal", "Northstar Analytics", "12 min ago", "#dce7f7"],
							["SK", "Lead marked as qualified", "Horizon Labs", "38 min ago", "#f3ddd2"],
							["AM", "Meeting scheduled", "Bluepeak Studio", "1 hr ago", "#dfeee5"],
						].map(
							([initial, title, company, time, bg]) => (
								<div key={title} className="flex items-center gap-3">
									<span
										className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold"
										style={{ background: bg }}
									>
										{initial}
									</span>
									<div className="min-w-0 flex-1">
										<p className="text-xs font-bold">{title}</p>
										<p className="mt-0.5 text-[11px] text-[#929aaa]">
											{company}
										</p>
									</div>
									<span className="text-[10px] text-[#9da3ae]">{time}</span>
								</div>
							)
						)}
					</div>
				</article>
				<article className="rounded-xl border border-[#e7e9ed] bg-white p-5">
					<h3 className="text-sm font-bold">Upcoming follow-ups</h3>
					<div className="mt-4 space-y-3">
						{[
							["10:30", "Discovery call", "Northstar Analytics"],
							["13:00", "Proposal review", "Horizon Labs"],
							["15:30", "Check-in", "Bluepeak Studio"],
						].map(
							([time, title, company]) => (
								<div
									key={title}
									className="flex gap-3 border-b border-[#f0f1f3] pb-3 last:border-0 last:pb-0"
								>
									<span className="text-[11px] font-bold text-[#ed6a5a]">
										{time}
									</span>
									<div>
										<p className="text-xs font-bold">{title}</p>
										<p className="mt-0.5 text-[11px] text-[#929aaa]">
											{company}
										</p>
									</div>
								</div>
							)
						)}
					</div>
				</article>
				<article className="rounded-xl border border-[#e7e9ed] bg-white p-5">
					<h3 className="text-sm font-bold">Lead sources</h3>
					<div className="mt-5 space-y-4">
						{[
							["Referral", "38%", "#ed6a5a"],
							["Website", "27%", "#80a0ca"],
							["LinkedIn", "21%", "#65a57d"],
							["Events", "14%", "#dcae72"],
						].map(
							([name, pct, color]) => (
								<div key={name}>
									<div className="mb-1.5 flex justify-between text-[11px]">
										<span className="font-semibold">{name}</span>
										<span className="text-[#929aaa]">{pct}</span>
									</div>
									<div className="h-1.5 rounded-full bg-[#eff1f4]">
										<div
											className="h-full rounded-full"
											style={{ width: pct, background: color }}
										/>
									</div>
								</div>
							)
						)}
					</div>
				</article>
			</section>

			{modal && (
				<div
					className="fixed inset-0 z-[70] grid place-items-center bg-[#17253a]/35 p-4"
					role="dialog"
					aria-modal="true"
				>
					<form
						onSubmit={(e) => {
							
							e.preventDefault();
							setModal(false);
						}}
						className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
					>
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-bold">Add a new lead</h3>
							<button
								type="button"
								onClick={() => setModal(false)}
								className="text-xl text-[#9aa1ad]"
								aria-label="Close"
							>
								×
							</button>
						</div>
						<div className="mt-5 space-y-3">
							<label className="block text-xs font-bold">
								Name
								<input
									required
									className="mt-1 w-full rounded-lg border border-[#dde1e7] px-3 py-2.5 text-sm"
									placeholder="Lead name"
								/>
							</label>
							<label className="block text-xs font-bold">
								Company
								<input
									required
									className="mt-1 w-full rounded-lg border border-[#dde1e7] px-3 py-2.5 text-sm"
									placeholder="Company name"
								/>
							</label>
							<label className="block text-xs font-bold">
								Email
								<input
									required
									type="email"
									className="mt-1 w-full rounded-lg border border-[#dde1e7] px-3 py-2.5 text-sm"
									placeholder="name@company.com"
								/>
							</label>
						</div>
						<div className="mt-6 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setModal(false)}
								className="rounded-lg border border-[#dde1e7] px-4 py-2.5 text-sm font-bold"
							>
								Cancel
							</button>
							<button className="rounded-lg bg-[#ed6a5a] px-4 py-2.5 text-sm font-bold text-white">
								Create lead
							</button>
						</div>
					</form>
				</div>
			)}
		</div>
	);
}

