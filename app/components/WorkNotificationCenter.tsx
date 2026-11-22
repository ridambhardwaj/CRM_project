"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { markWorkNotificationsRead, readWorkNotifications, workNotificationsUpdateEvent, type WorkNotification } from "@/app/lib/work-notifications";

export default function WorkNotificationCenter() {
	const [notifications, setNotifications] = useState<WorkNotification[]>([]);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const refresh = () => setNotifications(readWorkNotifications());
		refresh();
		window.addEventListener("storage", refresh);
		window.addEventListener(workNotificationsUpdateEvent(), refresh);
		return () => {
			window.removeEventListener("storage", refresh);
			window.removeEventListener(workNotificationsUpdateEvent(), refresh);
		};
	}, []);

	const unread = notifications.filter((notification) => !notification.read).length;

	return (
		<div className="relative">
			<button onClick={() => setOpen((value) => !value)} className="relative grid h-10 w-10 place-items-center rounded-lg border border-[#e4e7ec] text-[#596274]" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open}>
				<Bell size={18}/>{unread > 0 && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ed6a5a] px-1 text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
			</button>
			{open && <section className="absolute right-0 top-12 z-[80] w-[min(360px,calc(100vw-32px))] border border-[#e4e7ec] bg-white shadow-xl" aria-label="Notifications">
				<header className="flex items-center justify-between border-b border-[#edf0f3] px-4 py-3"><div><h2 className="text-xs font-bold">Notifications</h2><p className="mt-0.5 text-[10px] text-[#8b93a0]">{unread ? `${unread} unread` : "You're all caught up"}</p></div>{unread > 0 && <button onClick={markWorkNotificationsRead} className="flex items-center gap-1.5 text-[10px] font-bold text-[#697588]"><CheckCheck size={14}/>Mark all read</button>}</header>
				<div className="max-h-[360px] overflow-y-auto">
					{notifications.slice(0, 12).map((notification) => <article key={notification.id} className={`border-b border-[#f0f1f3] px-4 py-3 last:border-0 ${notification.read ? "bg-white" : "bg-[#fffaf8]"}`}><div className="flex items-start gap-2.5"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.read ? "bg-transparent" : "bg-[#ed6a5a]"}`}/><div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#354258]">{notification.title}</p><p className="mt-1 text-[11px] leading-4 text-[#7d8795]">{notification.message}</p><time className="mt-1.5 block text-[9px] text-[#9aa1ad]">{new Date(notification.createdAt).toLocaleString()}</time></div></div></article>)}
					{notifications.length === 0 && <p className="px-4 py-8 text-center text-xs text-[#8b93a0]">New task and schedule updates will appear here.</p>}
				</div>
				<p className="border-t border-[#edf0f3] px-4 py-2 text-[9px] text-[#99a1ad]">Saved in this browser. Server notifications require the Supabase setup.</p>
			</section>}
		</div>
	);
}
