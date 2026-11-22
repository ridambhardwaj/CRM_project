"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell, CalendarDays, ChevronDown, LayoutDashboard, ListFilter,
  Menu, Settings, Users, WalletCards, X, ChartNoAxesCombined, ListChecks,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Pipeline", href: "/pipeline", icon: WalletCards },
  { name: "Activities", href: "/activities", icon: ListChecks },
  { name: "Team", href: "/team", icon: Users },
  { name: "Reports", href: "/reports", icon: ChartNoAxesCombined },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageName = navigation.find((item) => item.href === pathname)?.name
    ?? (pathname === "/settings" ? "Settings" : "CRM");

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#18212f]">
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-[#17253a] text-white transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[76px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="Elestial CRM home">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#ed6a5a] text-lg font-bold">E</span>
            <div>
              <p className="text-[15px] font-bold tracking-wide">Elestial</p>
              <p className="text-[11px] text-slate-400">CRM Suite</p>
            </div>
          </Link>
          <button className="rounded-md p-1 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20}/></button>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-3" aria-label="Main navigation">
          {navigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.name} href={item.href} onClick={() => setMobileOpen(false)} className={`flex h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-semibold transition ${active ? "bg-[#25364d] text-white" : "text-slate-300 hover:bg-[#203149] hover:text-white"}`}>
                <Icon size={18} strokeWidth={1.8}/>
                {item.name}
                {item.name === "Activities" && <span className="ml-auto rounded-full bg-[#ed6a5a] px-2 py-0.5 text-[10px] text-white">5</span>}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4">
          <Link href="/settings" onClick={() => setMobileOpen(false)} className={`flex h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-semibold ${pathname === "/settings" ? "bg-[#25364d]" : "text-slate-300 hover:bg-[#203149]"}`}>
            <Settings size={18} strokeWidth={1.8}/> Settings
          </Link>
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/8 px-3 py-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#d9a46e] text-xs font-bold text-[#17253a]">MR</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">Maya Reynolds</p>
              <p className="text-[10px] text-slate-400">Sales Manager</p>
            </div>
            <ChevronDown size={14} className="text-slate-400"/>
          </div>
        </div>
      </aside>

      {mobileOpen && <button aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)}/>} 

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#e7e9ed] bg-white/95 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-[#e4e7ec] p-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20}/></button>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9aa1ab]">Workspace</p>
              <h1 className="text-lg font-bold tracking-tight text-[#17253a]">{pageName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button className="hidden h-10 items-center gap-2 rounded-lg border border-[#e4e7ec] px-3 text-xs font-semibold text-[#596274] sm:flex"><CalendarDays size={16}/> Nov 1 – Nov 20</button>
            <button className="relative grid h-10 w-10 place-items-center rounded-lg border border-[#e4e7ec] text-[#596274]" aria-label="Notifications"><Bell size={18}/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#ed6a5a]"/></button>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-[#f1e2d3] text-xs font-bold text-[#7b5540]">MR</button>
          </div>
        </header>
        <main className="min-h-[calc(100vh-76px)] p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}

