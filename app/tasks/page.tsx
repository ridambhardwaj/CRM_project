"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Copy,
  Ellipsis,
  ListFilter,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { publishWorkNotification } from "@/app/lib/work-notifications";

type Priority = "Urgent" | "High" | "Normal" | "Low";
type TaskStatus = "To do" | "In progress" | "On hold" | "Done";
type RequirementStatus = "Needed" | "In progress" | "Received";
type WorkTab = "Tasks" | "Client requirements" | "Calendar";
type CalendarMode = "Day" | "Week" | "Month";
type WorkList = { id: string; name: string; archived: boolean };
type WorkTask = {
  id: string;
  title: string;
  description: string;
  notes: string;
  attachments: string[];
  client: string;
  assignee: string;
  assignedBy: string;
  initials: string;
  team: string;
  start: string;
  due: string;
  priority: Priority;
  status: TaskStatus;
  listId: string;
};
type ClientRequirement = {
  id: string;
  client: string;
  title: string;
  owner: string;
  team: string;
  due: string;
  details: string;
  comments: string;
  attachments: string[];
  status: RequirementStatus;
};
type WorkEvent = {
  id: string;
  title: string;
  client: string;
  owner: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  agenda: string;
  participants: string;
  reminder: string;
  kind: "Meeting" | "Call" | "Reminder";
};
type ModalState =
  | { kind: "task"; item?: WorkTask; client?: string }
  | { kind: "requirement"; client?: string; item?: ClientRequirement }
  | { kind: "list"; item?: WorkList }
  | { kind: "event"; item?: WorkEvent }
  | { kind: "event-detail"; item: WorkEvent }
  | null;

const initialLists: WorkList[] = [
  { id: "lst-priority", name: "Priority work", archived: false },
  { id: "lst-follow-up", name: "Client follow-up", archived: false },
  { id: "lst-onboarding", name: "Onboarding", archived: false },
  { id: "lst-archived", name: "Spring launch", archived: true },
];

const initialTasks: WorkTask[] = [
  { id: "tsk-1", title: "Send revised proposal and pricing", description: "Update the proposal with the revised implementation timeline.", notes: "Confirm totals with finance before sending.", attachments: [], client: "Northstar Analytics", assignee: "Maya Reynolds", assignedBy: "Maya Reynolds", initials: "MR", team: "Sales", start: "2026-11-20", due: "2026-11-22", priority: "Urgent", status: "In progress", listId: "lst-priority" },
  { id: "tsk-2", title: "Confirm security review attendees", description: "Collect names and roles for the security review.", notes: "", attachments: [], client: "Horizon Labs", assignee: "Sam Kim", assignedBy: "Maya Reynolds", initials: "SK", team: "Sales", start: "2026-11-22", due: "2026-11-23", priority: "High", status: "To do", listId: "lst-priority" },
  { id: "tsk-3", title: "Share implementation timeline", description: "Prepare a milestone timeline for the client.", notes: "", attachments: [], client: "LumaWorks", assignee: "Jordan Diaz", assignedBy: "Maya Reynolds", initials: "JD", team: "Customer success", start: "2026-11-23", due: "2026-11-24", priority: "Normal", status: "To do", listId: "lst-priority" },
  { id: "tsk-4", title: "Book technical discovery", description: "Find a time with the client engineering team.", notes: "", attachments: [], client: "Bluepeak Studio", assignee: "Avery Morgan", assignedBy: "Maya Reynolds", initials: "AM", team: "Sales", start: "2026-11-24", due: "2026-11-25", priority: "High", status: "To do", listId: "lst-follow-up" },
  { id: "tsk-5", title: "Send onboarding checklist", description: "Share the onboarding checklist and confirm owners.", notes: "", attachments: [], client: "Cedar & Co.", assignee: "Maya Reynolds", assignedBy: "Maya Reynolds", initials: "MR", team: "Customer success", start: "2026-11-25", due: "2026-11-26", priority: "Normal", status: "In progress", listId: "lst-onboarding" },
  { id: "tsk-6", title: "Verify workspace access", description: "Check that all requested users can sign in.", notes: "", attachments: [], client: "Meridian Health", assignee: "Sam Kim", assignedBy: "Maya Reynolds", initials: "SK", team: "Customer success", start: "2026-11-26", due: "2026-11-27", priority: "Low", status: "Done", listId: "lst-onboarding" },
  { id: "tsk-7", title: "Follow up on contract signature", description: "Check the signature status with the client contact.", notes: "", attachments: [], client: "Vertex Systems", assignee: "Jordan Diaz", assignedBy: "Maya Reynolds", initials: "JD", team: "Sales", start: "2026-11-27", due: "2026-11-28", priority: "Normal", status: "To do", listId: "lst-follow-up" },
  { id: "tsk-8", title: "Share kickoff notes", description: "Send the kickoff notes and next steps.", notes: "", attachments: [], client: "Orbit Commerce", assignee: "Avery Morgan", assignedBy: "Maya Reynolds", initials: "AM", team: "Customer success", start: "2026-11-29", due: "2026-11-30", priority: "Low", status: "Done", listId: "lst-archived" },
];

const initialRequirements: ClientRequirement[] = [
  { id: "req-1", client: "Northstar Analytics", title: "Signed data processing agreement", owner: "Maya Reynolds", team: "Sales", due: "2026-11-24", details: "Signed copy of the current DPA.", comments: "Legal review requested.", attachments: [], status: "In progress" },
  { id: "req-2", client: "Northstar Analytics", title: "Security questionnaire", owner: "Sam Kim", team: "Customer success", due: "2026-11-26", details: "Complete the vendor security questionnaire.", comments: "", attachments: [], status: "Needed" },
  { id: "req-3", client: "Horizon Labs", title: "Current vendor list", owner: "Jordan Diaz", team: "Sales", due: "2026-11-25", details: "List current analytics vendors.", comments: "", attachments: [], status: "Needed" },
  { id: "req-4", client: "Horizon Labs", title: "Technical environment overview", owner: "Avery Morgan", team: "Customer success", due: "2026-11-28", details: "Overview of the current hosting and identity setup.", comments: "", attachments: [], status: "Received" },
  { id: "req-5", client: "Bluepeak Studio", title: "Brand asset package", owner: "Maya Reynolds", team: "Design", due: "2026-11-29", details: "Logo files, brand colors, and type specifications.", comments: "", attachments: [], status: "In progress" },
  { id: "req-6", client: "Cedar & Co.", title: "Billing contact details", owner: "Sam Kim", team: "Operations", due: "2026-11-30", details: "Name and email for invoices.", comments: "", attachments: [], status: "Received" },
];

const initialEvents: WorkEvent[] = [
  { id: "evt-1", title: "Northstar proposal review", client: "Northstar Analytics", owner: "Maya Reynolds", date: "2026-11-22", startTime: "10:30", endTime: "11:15", location: "Video call", agenda: "Review revised proposal and agree on next steps.", participants: "Maya Reynolds, Olivia Martin", reminder: "30 minutes before", kind: "Meeting" },
  { id: "evt-2", title: "Horizon technical discovery", client: "Horizon Labs", owner: "Jordan Diaz", date: "2026-11-23", startTime: "13:00", endTime: "14:00", location: "Video call", agenda: "Understand the existing technical environment.", participants: "Jordan Diaz, Jackson Lee", reminder: "2 hours before", kind: "Call" },
  { id: "evt-3", title: "Bluepeak kickoff planning", client: "Bluepeak Studio", owner: "Avery Morgan", date: "2026-11-24", startTime: "11:00", endTime: "12:00", location: "Conference room A", agenda: "Align on scope, timeline, and owners.", participants: "Avery Morgan, Sophia Kim", reminder: "1 day before", kind: "Meeting" },
  { id: "evt-4", title: "Cedar onboarding check-in", client: "Cedar & Co.", owner: "Sam Kim", date: "2026-11-26", startTime: "14:30", endTime: "15:00", location: "Video call", agenda: "Review onboarding progress and open questions.", participants: "Sam Kim, Ava Wilson", reminder: "30 minutes before", kind: "Meeting" },
  { id: "evt-5", title: "Contract signature follow-up", client: "Vertex Systems", owner: "Maya Reynolds", date: "2026-11-27", startTime: "09:30", endTime: "09:45", location: "Phone", agenda: "Confirm signature status.", participants: "Maya Reynolds", reminder: "Custom: 15 minutes before", kind: "Reminder" },
];

const people = ["Maya Reynolds", "Sam Kim", "Jordan Diaz", "Avery Morgan"];
const clients = ["Northstar Analytics", "Horizon Labs", "Bluepeak Studio", "LumaWorks", "Cedar & Co.", "Vertex Systems", "Meridian Health", "Orbit Commerce"];
const initialsFor = (name: string) => name.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase();
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateOffset = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};
const taskStatusClass: Record<TaskStatus, string> = {
  "To do": "bg-[#f1f3f6] text-[#657286]",
  "In progress": "bg-[#fff2e8] text-[#b66b3f]",
  "On hold": "bg-[#f1ebfa] text-[#745f91]",
  Done: "bg-[#eaf5ee] text-[#4c8660]",
};
const priorityClass: Record<Priority, string> = {
  Urgent: "text-[#c84f43]",
  High: "text-[#c77a46]",
  Normal: "text-[#718097]",
  Low: "text-[#9aa1ad]",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-bold text-[#455166]">{label}<span className="mt-1.5 block">{children}</span></label>;
}

function inputClass() {
  return "h-10 w-full rounded-md border border-[#dfe4ea] bg-white px-3 text-sm font-medium text-[#18212f] outline-none focus:border-[#ed6a5a]";
}

function normalizeTask(saved: Partial<WorkTask>): WorkTask {
  return {
    id: saved.id ?? `tsk-${Date.now()}`,
    title: saved.title ?? "Untitled task",
    description: saved.description ?? "",
    notes: saved.notes ?? "",
    attachments: Array.isArray(saved.attachments) ? saved.attachments : [],
    client: saved.client ?? clients[0],
    assignee: saved.assignee ?? people[0],
    assignedBy: saved.assignedBy ?? "Maya Reynolds",
    initials: saved.initials ?? initialsFor(saved.assignee ?? people[0]),
    team: saved.team ?? "Sales",
    start: saved.start ?? saved.due ?? "",
    due: saved.due ?? "",
    priority: saved.priority ?? "Normal",
    status: saved.status ?? "To do",
    listId: saved.listId ?? "",
  };
}

function normalizeRequirement(saved: Partial<ClientRequirement>): ClientRequirement {
  return {
    id: saved.id ?? `req-${Date.now()}`,
    client: saved.client ?? clients[0],
    title: saved.title ?? "Untitled requirement",
    owner: saved.owner ?? people[0],
    team: saved.team ?? "Customer success",
    due: saved.due ?? "",
    details: saved.details ?? "",
    comments: saved.comments ?? "",
    attachments: Array.isArray(saved.attachments) ? saved.attachments : [],
    status: saved.status ?? "Needed",
  };
}

function normalizeEvent(saved: Partial<WorkEvent> & { time?: string }): WorkEvent {
  return {
    id: saved.id ?? `evt-${Date.now()}`,
    title: saved.title ?? "Untitled event",
    client: saved.client ?? clients[0],
    owner: saved.owner ?? people[0],
    date: saved.date ?? isoDate(new Date()),
    startTime: saved.startTime ?? saved.time ?? "10:00",
    endTime: saved.endTime ?? "10:30",
    location: saved.location ?? "",
    agenda: saved.agenda ?? "",
    participants: saved.participants ?? "",
    reminder: saved.reminder ?? "30 minutes before",
    kind: saved.kind ?? "Meeting",
  };
}

export default function TasksPage() {
  const [lists, setLists] = useState(initialLists);
  const [tasks, setTasks] = useState(initialTasks);
  const [requirements, setRequirements] = useState(initialRequirements);
  const [events, setEvents] = useState(initialEvents);
  const [activeTab, setActiveTab] = useState<WorkTab>("Tasks");
  const [activeListId, setActiveListId] = useState("lst-priority");
  const [showArchived, setShowArchived] = useState(false);
  const [listMenuId, setListMenuId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState("All tasks");
  const [teamFilter, setTeamFilter] = useState("All teams");
  const [assigneeFilter, setAssigneeFilter] = useState("All employees");
  const [priorityFilter, setPriorityFilter] = useState("All priorities");
  const [sortBy, setSortBy] = useState("Due date");
  const [modal, setModal] = useState<ModalState>(null);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("Week");
  const [calendarDate, setCalendarDate] = useState(new Date(2026, 10, 22));
  const [calendarEvents, setCalendarEvents] = useState<WorkEvent[]>(events);
  const [storageReady, setStorageReady] = useState(false);
  const [todayKey, setTodayKey] = useState("2026-11-22");

  useEffect(() => {
    const restoreWorkspace = (saved: string | null) => {
      try {
        const workspace = saved ? JSON.parse(saved) as { lists?: WorkList[]; tasks?: Partial<WorkTask>[]; requirements?: Partial<ClientRequirement>[]; events?: (Partial<WorkEvent> & { time?: string })[]; activeListId?: string } : null;
        startTransition(() => {
          if (workspace && Array.isArray(workspace.lists)) {
            setLists(workspace.lists);
            setActiveListId(workspace.lists.some((list) => list.id === workspace.activeListId)
              ? workspace.activeListId!
              : workspace.lists.find((list) => !list.archived)?.id ?? "");
          }
          if (workspace && Array.isArray(workspace.tasks)) setTasks(workspace.tasks.map(normalizeTask));
          if (workspace && Array.isArray(workspace.requirements)) setRequirements(workspace.requirements.map(normalizeRequirement));
          if (workspace && Array.isArray(workspace.events)) {
            const restoredEvents = workspace.events.map(normalizeEvent);
            setEvents(restoredEvents);
            setCalendarEvents(restoredEvents);
          }
          setTodayKey(isoDate(new Date()));
          setCalendarDate(new Date());
          setStorageReady(true);
        });
      } catch {
        localStorage.removeItem("elestial-workspace-v1");
        startTransition(() => setStorageReady(true));
      }
    };
    try {
      restoreWorkspace(localStorage.getItem("elestial-workspace-v1"));
    } catch {
      startTransition(() => setStorageReady(true));
    }

    const syncOtherTabs = (event: StorageEvent) => {
      if (event.key === "elestial-workspace-v1") restoreWorkspace(event.newValue);
    };
    window.addEventListener("storage", syncOtherTabs);
    return () => window.removeEventListener("storage", syncOtherTabs);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem("elestial-workspace-v1", JSON.stringify({ lists, tasks, requirements, events: calendarEvents, activeListId }));
    } catch {
    }
  }, [activeListId, calendarEvents, lists, requirements, storageReady, tasks]);

  const activeList = lists.find((list) => list.id === activeListId) ?? lists[0];
  const visibleLists = lists.filter((list) => list.archived === showArchived);
  const openTasks = tasks.filter((task) => task.status !== "Done");
  const doneTasks = tasks.filter((task) => task.status === "Done");
  const overdueTasks = openTasks.filter((task) => task.due && task.due < todayKey);
  const todayTasks = openTasks.filter((task) => task.due === todayKey);
  const upcomingEvents = calendarEvents.filter((event) => event.date >= todayKey);
  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      const matchesList = task.listId === activeListId;
      const matchesQuery = `${task.title} ${task.client} ${task.assignee} ${task.team}`.toLowerCase().includes(query.toLowerCase());
      const matchesFilter = taskFilter === "All tasks"
        || (taskFilter === "Open" && task.status !== "Done")
        || (taskFilter === "Completed" && task.status === "Done")
        || (taskFilter === "Overdue" && task.status !== "Done" && task.due < todayKey)
        || (taskFilter === "Due today" && task.status !== "Done" && task.due === todayKey)
        || (taskFilter === "Due this week" && task.status !== "Done" && task.due >= todayKey && task.due <= isoDate(dateOffset(new Date(`${todayKey}T12:00:00`), 6)));
      const matchesTeam = teamFilter === "All teams" || task.team === teamFilter;
      const matchesAssignee = assigneeFilter === "All employees" || task.assignee === assigneeFilter;
      const matchesPriority = priorityFilter === "All priorities" || task.priority === priorityFilter;
      return matchesList && matchesQuery && matchesFilter && matchesTeam && matchesAssignee && matchesPriority;
    });
    const priorityOrder: Priority[] = ["Urgent", "High", "Normal", "Low"];
    return filtered.sort((first, second) => {
      if (sortBy === "Priority") return priorityOrder.indexOf(first.priority) - priorityOrder.indexOf(second.priority);
      if (sortBy === "Task name") return first.title.localeCompare(second.title);
      return first.due.localeCompare(second.due);
    });
  }, [activeListId, assigneeFilter, priorityFilter, query, sortBy, taskFilter, tasks, teamFilter, todayKey]);

  const eventsForDate = (date: string) => calendarEvents.filter((event) => event.date === date);
  const calendarStart = calendarMode === "Day"
    ? new Date(calendarDate)
    : calendarMode === "Week"
      ? dateOffset(calendarDate, -((calendarDate.getDay() + 6) % 7))
      : new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const calendarDays = calendarMode === "Day"
    ? [calendarStart]
    : calendarMode === "Week"
      ? Array.from({ length: 7 }, (_, index) => dateOffset(calendarStart, index))
      : Array.from({ length: 42 }, (_, index) => dateOffset(new Date(calendarStart.getFullYear(), calendarStart.getMonth(), 1 - ((calendarStart.getDay() + 6) % 7)), index));
  const calendarTitle = calendarMode === "Day"
    ? calendarDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : calendarMode === "Week"
      ? `${calendarStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${dateOffset(calendarStart, 6).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      : calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.kind !== "task") return;
    const form = new FormData(event.currentTarget);
    const assignee = String(form.get("assignee"));
    const status = String(form.get("status")) as TaskStatus;
    const nextTask: WorkTask = {
      id: modal.item?.id ?? `tsk-${Date.now()}`,
      title: String(form.get("title")).trim(),
      description: String(form.get("description")),
      notes: String(form.get("notes")),
      attachments: String(form.get("attachments")).split(",").map((value) => value.trim()).filter(Boolean),
      client: String(form.get("client")),
      assignee,
      assignedBy: modal.item?.assignedBy ?? "Maya Reynolds",
      initials: initialsFor(assignee),
      team: String(form.get("team")),
      start: String(form.get("start")),
      due: String(form.get("due")),
      priority: String(form.get("priority")) as Priority,
      status,
      listId: String(form.get("listId")),
    };
    setTasks((current) => modal.item ? current.map((task) => task.id === modal.item?.id ? nextTask : task) : [nextTask, ...current]);
    if (assignee !== "Maya Reynolds" && (!modal.item || modal.item.assignee !== assignee)) {
      publishWorkNotification("Task handed over", `${nextTask.title} assigned to ${assignee} · ${nextTask.team} · due ${dateLabel(nextTask.due)}.`);
    }
    setActiveListId(nextTask.listId);
    setModal(null);
  }

  function saveList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.kind !== "list") return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    if (!name) return;
    if (modal.item) {
      setLists((current) => current.map((list) => list.id === modal.item?.id ? { ...list, name } : list));
    } else {
      const id = `lst-${Date.now()}`;
      setLists((current) => [...current, { id, name, archived: false }]);
      setActiveListId(id);
      setShowArchived(false);
    }
    setModal(null);
  }

  function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.kind !== "event") return;
    const form = new FormData(event.currentTarget);
    const nextEvent: WorkEvent = {
      id: modal.item?.id ?? `evt-${Date.now()}`,
      title: String(form.get("title")).trim(),
      client: String(form.get("client")),
      owner: String(form.get("owner")),
      date: String(form.get("date")),
      startTime: String(form.get("startTime")),
      endTime: String(form.get("endTime")),
      location: String(form.get("location")),
      agenda: String(form.get("agenda")),
      participants: String(form.get("participants")),
      reminder: String(form.get("reminder")) === "Custom"
        ? `Custom: ${String(form.get("customReminderMinutes") || "15")} minutes before`
        : String(form.get("reminder")),
      kind: String(form.get("kind")) as WorkEvent["kind"],
    };
    setEvents((current) => modal.item ? current.map((item) => item.id === modal.item?.id ? nextEvent : item) : [...current, nextEvent]);
    setCalendarEvents((current) => modal.item ? current.map((item) => item.id === modal.item?.id ? nextEvent : item) : [...current, nextEvent]);
    if (nextEvent.owner !== "Maya Reynolds") {
      publishWorkNotification(modal.item ? "Meeting schedule updated" : "New meeting scheduled", `${nextEvent.title} · ${nextEvent.date} at ${nextEvent.startTime} · assigned to ${nextEvent.owner}.`);
    }
    setCalendarDate(new Date(`${nextEvent.date}T12:00:00`));
    setModal(null);
  }

  function saveRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.kind !== "requirement") return;
    const form = new FormData(event.currentTarget);
    const attachments = String(form.get("attachments")).split(",").map((value) => value.trim()).filter(Boolean);
    const nextRequirement: ClientRequirement = {
      id: modal.item?.id ?? `req-${Date.now()}`,
      client: String(form.get("client")),
      title: String(form.get("title")).trim(),
      owner: String(form.get("owner")),
      team: String(form.get("team")),
      due: String(form.get("due")),
      details: String(form.get("details")),
      comments: String(form.get("comments")),
      attachments,
      status: modal.item?.status ?? "Needed",
    };
    setRequirements((current) => modal.item
      ? current.map((item) => item.id === modal.item?.id ? nextRequirement : item)
      : [nextRequirement, ...current]);
    if (nextRequirement.owner !== "Maya Reynolds") {
      publishWorkNotification("Client requirement updated", `${nextRequirement.title} for ${nextRequirement.client} is assigned to ${nextRequirement.owner}.`);
    }
    setModal(null);
  }

  function deleteTask(task: WorkTask) {
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setModal(null);
  }

  function toggleTask(task: WorkTask) {
    const completing = task.status !== "Done";
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: completing ? "Done" : "To do" } : item));
    if (completing) publishWorkNotification("Task completed", `${task.title} · ${task.client}`);
  }

  function updateRequirement(requirement: ClientRequirement) {
    const statuses: RequirementStatus[] = ["Needed", "In progress", "Received"];
    const nextStatus = statuses[(statuses.indexOf(requirement.status) + 1) % statuses.length];
    setRequirements((current) => current.map((item) => item.id === requirement.id ? { ...item, status: nextStatus } : item));
    publishWorkNotification("Requirement progress updated", `${requirement.title} for ${requirement.client} is now ${nextStatus.toLowerCase()}.`);
  }

  function manageList(action: "duplicate" | "archive" | "restore" | "delete", list: WorkList) {
    setListMenuId(null);
    if (action === "duplicate") {
      let copyIndex = 1;
      let id = `${list.id}-copy`;
      while (lists.some((existing) => existing.id === id)) {
        copyIndex += 1;
        id = `${list.id}-copy-${copyIndex}`;
      }
      setLists((current) => [...current, { id, name: `${list.name} copy`, archived: false }]);
      setTasks((current) => [...current, ...current.filter((task) => task.listId === list.id).map((task) => ({ ...task, id: `${id}-${task.id}`, listId: id }))]);
      setShowArchived(false);
      setActiveListId(id);
      return;
    }
    if (action === "archive" || action === "restore") {
      const archived = action === "archive";
      setLists((current) => current.map((item) => item.id === list.id ? { ...item, archived } : item));
      if (archived && activeListId === list.id) {
        const replacement = lists.find((item) => item.id !== list.id && !item.archived);
        if (replacement) setActiveListId(replacement.id);
      }
      if (!archived) setActiveListId(list.id);
      return;
    }
    if (!window.confirm(`Delete “${list.name}”? Tasks in this list will move to another active list.`)) return;
    const replacement = lists.find((item) => item.id !== list.id && !item.archived);
    setLists((current) => current.filter((item) => item.id !== list.id));
    if (replacement) setTasks((current) => current.map((task) => task.listId === list.id ? { ...task, listId: replacement.id } : task));
    else setTasks((current) => current.filter((task) => task.listId !== list.id));
    if (activeListId === list.id && replacement) setActiveListId(replacement.id);
  }

  function moveCalendar(direction: -1 | 1) {
    const amount = calendarMode === "Day" ? 1 : calendarMode === "Week" ? 7 : 30;
    setCalendarDate((current) => calendarMode === "Month"
      ? new Date(current.getFullYear(), current.getMonth() + direction, 1)
      : dateOffset(current, amount * direction));
  }

  const groupedRequirements = clients
    .map((client) => ({ client, items: requirements.filter((item) => item.client === client) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#ed6a5a]">Team work center</p>
          <h2 className="mt-1 text-[26px] font-bold tracking-tight text-[#17253a]">Tasks &amp; schedules</h2>
          <p className="mt-1 text-sm text-[#7b8493]">Keep client work moving, all in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setModal({ kind: "list" })} className="flex h-10 items-center gap-2 border border-[#dfe4ea] bg-white px-3.5 text-xs font-bold text-[#435067] hover:bg-[#f8f9fa]"><Plus size={15}/>New list</button>
          <button onClick={() => { setActiveTab("Client requirements"); setModal({ kind: "requirement" }); }} className="flex h-10 items-center gap-2 border border-[#dfe4ea] bg-white px-3.5 text-xs font-bold text-[#435067] hover:bg-[#f8f9fa]"><Plus size={15}/>Add requirement</button>
          <button onClick={() => setModal({ kind: "event" })} className="flex h-10 items-center gap-2 rounded-md border border-[#dfe4ea] bg-white px-3.5 text-xs font-bold text-[#435067] hover:bg-[#f8f9fa]"><CalendarDays size={15}/>Schedule event</button>
          <button onClick={() => setModal({ kind: "task" })} className="flex h-10 items-center gap-2 rounded-md bg-[#ed6a5a] px-4 text-xs font-bold text-white hover:bg-[#dc5e50]"><Plus size={16}/>New task</button>
        </div>
      </div>

      <section aria-label="Work summary" className="mb-6 grid grid-cols-2 border-y border-[#e4e8ed] bg-white sm:grid-cols-4 xl:grid-cols-7">
        {[
          ["Total tasks", tasks.length, "#17253a"],
          ["Pending", tasks.filter((task) => task.status === "To do").length, "#657286"],
          ["In progress", tasks.filter((task) => task.status === "In progress").length, "#b66b3f"],
          ["Completed", doneTasks.length, "#4f8a63"],
          ["Overdue", overdueTasks.length, "#c84f43"],
          ["Due today", todayTasks.length, "#d07949"],
          ["Upcoming events", upcomingEvents.length, "#17253a"],
        ].map(([label, count, color], index) => <div key={label} className={`px-4 py-3.5 sm:px-5 ${index % 2 === 0 ? "border-r border-[#edf0f3]" : ""} ${index > 1 ? "border-t border-[#edf0f3] sm:border-t-0" : ""} ${index > 3 ? "xl:border-l xl:border-r-0 xl:border-t-0" : ""}`}><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#8d96a5]">{label}</p><p className="mt-1 text-xl font-bold" style={{ color: String(color) }}>{count}</p></div>)}
      </section>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-[#e4e8ed]" role="tablist" aria-label="Work views">
        {(["Tasks", "Client requirements", "Calendar"] as WorkTab[]).map((tab) => (
          <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`-mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-bold transition ${activeTab === tab ? "border-[#ed6a5a] text-[#17253a]" : "border-transparent text-[#8992a0] hover:text-[#455166]"}`}>
            {tab === "Tasks" ? <ListTodo size={15}/> : tab === "Client requirements" ? <CheckCircle2 size={15}/> : <CalendarDays size={15}/>} {tab}
            {tab === "Tasks" && <span className="rounded bg-[#f0f2f5] px-1.5 py-0.5 text-[10px] text-[#697386]">{openTasks.length}</span>}
          </button>
        ))}
      </div>

      {activeTab === "Tasks" && <div className="grid gap-6 lg:grid-cols-[244px_minmax(0,1fr)]">
        <aside aria-label="Task lists" className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7d8796]">My lists</h3>
            <button onClick={() => setShowArchived((value) => !value)} className="text-[10px] font-bold text-[#828c9b] hover:text-[#17253a]">{showArchived ? "Show active" : "Archived"}</button>
          </div>
          <div className="space-y-1.5">
            {visibleLists.map((list) => {
              const items = tasks.filter((task) => task.listId === list.id);
              const completed = items.filter((task) => task.status === "Done").length;
              const progress = items.length ? Math.round((completed / items.length) * 100) : 0;
              return <article key={list.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const taskId = event.dataTransfer.getData("text/plain"); if (taskId) { setTasks((current) => current.map((task) => task.id === taskId ? { ...task, listId: list.id } : task)); setActiveListId(list.id); setShowArchived(false); } }} className={`relative border px-3 py-3 transition ${activeListId === list.id ? "border-[#dfe4ea] bg-white shadow-[0_1px_3px_rgba(23,37,58,.04)]" : "border-transparent hover:bg-white/70"}`}>
                <div className="flex items-start gap-2">
                  <button onClick={() => setActiveListId(list.id)} className="min-w-0 flex-1 text-left" aria-pressed={activeListId === list.id}>
                    <span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-bold text-[#273449]">{list.name}</span><span className="text-[10px] font-semibold text-[#9099a7]">{items.length}</span></span>
                    <span className="mt-2 block h-1 overflow-hidden rounded-full bg-[#edf0f3]"><span className="block h-full rounded-full bg-[#76a987]" style={{ width: `${progress}%` }}/></span>
                    <span className="mt-1.5 block text-[10px] text-[#9099a7]">{completed} of {items.length} complete{list.archived ? " · archived" : ""}</span>
                  </button>
                  <button aria-label={`Manage ${list.name}`} onClick={() => setListMenuId((current) => current === list.id ? null : list.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded text-[#8e97a4] hover:bg-[#edf0f3] hover:text-[#354258]"><Ellipsis size={17}/></button>
                </div>
                {listMenuId === list.id && <div className="absolute right-2 top-10 z-20 w-40 border border-[#e4e8ed] bg-white py-1 shadow-lg">
                  {!list.archived && <button onClick={() => { setModal({ kind: "list", item: list }); setListMenuId(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#4d596c] hover:bg-[#f6f7f9]"><Pencil size={13}/>Rename list</button>}
                  {!list.archived && <button onClick={() => manageList("duplicate", list)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#4d596c] hover:bg-[#f6f7f9]"><Copy size={13}/>Duplicate</button>}
                  <button onClick={() => manageList(list.archived ? "restore" : "archive", list)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#4d596c] hover:bg-[#f6f7f9]"><ArrowDownWideNarrow size={13}/>{list.archived ? "Restore list" : "Archive list"}</button>
                  <button onClick={() => manageList("delete", list)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#b8544b] hover:bg-[#fff5f3]"><Trash2 size={13}/>Delete list</button>
                </div>}
              </article>;
            })}
            {visibleLists.length === 0 && <p className="px-2 py-4 text-xs text-[#8b95a4]">No {showArchived ? "archived" : "active"} lists.</p>}
          </div>
          {!showArchived && <button onClick={() => setModal({ kind: "list" })} className="mt-3 flex h-9 w-full items-center gap-2 border border-dashed border-[#d8dee6] px-3 text-xs font-bold text-[#687488] hover:border-[#ed6a5a] hover:text-[#b55c50]"><Plus size={15}/>Create a list</button>}
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#98a0ad]">{activeList?.archived ? "Archived list" : "Task list"}</p><h3 className="mt-1 truncate text-lg font-bold text-[#17253a]">{activeList?.name ?? "Choose a list"}</h3><p className="mt-0.5 text-xs text-[#929aa7]">{tasks.filter((task) => task.listId === activeListId).length} tasks · local workspace demo</p></div>
            <button onClick={() => setModal({ kind: "task" })} className="flex h-9 shrink-0 items-center justify-center gap-2 bg-[#17253a] px-3 text-xs font-bold text-white hover:bg-[#263a56]"><Plus size={15}/>Add task</button>
          </div>

          <div className="mb-3 flex flex-col gap-2 border-y border-[#e4e8ed] py-3">
            <div className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-2.5 text-[#99a1ad]"/><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search tasks" placeholder="Search tasks, clients, or assignees" className="h-9 w-full border border-[#dfe4ea] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#ed6a5a]"/></div>
            <div className="flex flex-wrap gap-2">
              <label className="relative flex min-w-0 items-center"><ListFilter size={14} className="pointer-events-none absolute left-2.5 text-[#8791a0]"/><select aria-label="Filter tasks" value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)} className="h-9 min-w-0 appearance-none border border-[#dfe4ea] bg-white pl-8 pr-7 text-[11px] font-semibold text-[#596579]"><option>All tasks</option><option>Open</option><option>Completed</option><option>Overdue</option><option>Due today</option><option>Due this week</option></select><ChevronDown size={12} className="pointer-events-none absolute right-2 text-[#8791a0]"/></label>
              <select aria-label="Filter by team" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="h-9 min-w-0 border border-[#dfe4ea] bg-white px-2 text-[11px] font-semibold text-[#596579]"><option>All teams</option>{[...new Set(tasks.map((task) => task.team))].map((team) => <option key={team}>{team}</option>)}</select>
              <select aria-label="Filter by employee" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className="h-9 min-w-0 border border-[#dfe4ea] bg-white px-2 text-[11px] font-semibold text-[#596579]"><option>All employees</option>{people.map((person) => <option key={person}>{person}</option>)}</select>
              <select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-9 min-w-0 border border-[#dfe4ea] bg-white px-2 text-[11px] font-semibold text-[#596579]"><option>All priorities</option>{(["Urgent", "High", "Normal", "Low"] as Priority[]).map((priority) => <option key={priority}>{priority}</option>)}</select>
              <label className="relative flex items-center"><select aria-label="Sort tasks" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="h-9 appearance-none border border-[#dfe4ea] bg-white pl-3 pr-7 text-[11px] font-semibold text-[#596579]"><option>Due date</option><option>Priority</option><option>Task name</option></select><ChevronDown size={12} className="pointer-events-none absolute right-2 text-[#8791a0]"/></label>
            </div>
          </div>

          <div className="overflow-hidden border border-[#e4e8ed] bg-white">
            <div className="hidden grid-cols-[28px_minmax(150px,1.6fr)_minmax(100px,1fr)_88px_82px_64px] gap-2 bg-[#f8f9fa] px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#8992a0] md:grid lg:grid-cols-[28px_minmax(220px,1.6fr)_minmax(130px,1fr)_112px_100px_90px] lg:gap-3 lg:px-4"><span/><span>Task</span><span>Client / team</span><span>Assignee</span><span>Due date</span><span>Priority</span></div>
            {visibleTasks.map((task) => (
              <article key={task.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", task.id)} className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-t border-[#edf0f3] px-3 py-3 first:border-t-0 sm:px-4 md:grid-cols-[28px_minmax(150px,1.6fr)_minmax(100px,1fr)_88px_82px_64px] md:gap-x-2 lg:grid-cols-[28px_minmax(220px,1.6fr)_minmax(130px,1fr)_112px_100px_90px] lg:gap-3">
                <button aria-label={task.status === "Done" ? `Reopen ${task.title}` : `Complete ${task.title}`} onClick={() => toggleTask(task)} className={`grid h-7 w-7 place-items-center rounded-full border transition md:order-0 ${task.status === "Done" ? "border-[#70a982] bg-[#70a982] text-white" : "border-[#d8dee6] text-transparent hover:border-[#70a982] hover:text-[#70a982]"}`}><Check size={14}/></button>
                <div className="min-w-0">
                  <button onClick={() => setModal({ kind: "task", item: task })} className={`block max-w-full truncate text-left text-xs font-bold hover:text-[#c35d51] ${task.status === "Done" ? "text-[#929aa7] line-through" : "text-[#273449]"}`}>{task.title}</button>
                  <span className={`mt-1.5 inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold ${taskStatusClass[task.status]}`}>{task.status}</span>
                </div>
                <div className="col-start-2 row-start-2 min-w-0 md:col-start-2 md:row-auto"><p className="truncate text-[10px] font-semibold text-[#566276] md:text-[11px]">{task.client}</p><p className="mt-0.5 truncate text-[9px] text-[#969eaa] md:text-[10px]">{task.team}</p></div>
                <div className="col-start-3 row-start-1 flex items-center justify-end gap-1.5 md:col-start-3 md:row-auto md:justify-start"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#f1e7de] text-[9px] font-bold text-[#775844]" title={task.assignee}>{task.initials}</span><span className="hidden truncate text-[10px] font-semibold text-[#596579] lg:block">{task.assignee.split(" ")[0]}</span></div>
                <p className="col-start-2 row-start-3 text-[10px] font-semibold text-[#697487] md:col-start-4 md:row-auto">Due {dateLabel(task.due)}</p>
                <p className={`col-start-3 row-start-3 text-right text-[10px] font-bold md:col-start-5 md:row-auto md:text-left ${priorityClass[task.priority]}`}>{task.priority}</p>
              </article>
            ))}
            {visibleTasks.length === 0 && <div className="px-5 py-12 text-center"><p className="text-sm font-bold text-[#4b586d]">No tasks match this view</p><p className="mt-1 text-xs text-[#929aa7]">Try another filter or add a task to {activeList?.name ?? "this list"}.</p><button onClick={() => { setQuery(""); setTaskFilter("All tasks"); setTeamFilter("All teams"); setAssigneeFilter("All employees"); setPriorityFilter("All priorities"); setModal({ kind: "task" }); }} className="mt-4 inline-flex h-9 items-center gap-2 bg-[#17253a] px-3 text-xs font-bold text-white"><Plus size={14}/>Create task</button></div>}
          </div>
          <p className="mt-2 text-[10px] text-[#969eaa]">Showing {visibleTasks.length} of {tasks.filter((task) => task.listId === activeListId).length} tasks</p>
        </section>
      </div>}

      {activeTab === "Client requirements" && <section>
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h3 className="text-lg font-bold text-[#17253a]">Client requirements</h3><p className="mt-1 text-xs text-[#858f9e]">Track the information and documents needed to move each account forward.</p></div><div className="flex items-center gap-3"><div className="flex items-center gap-2 text-[10px] font-semibold text-[#747f90]"><span className="h-2 w-2 rounded-full bg-[#d49a62]"/>{requirements.filter((item) => item.status !== "Received").length} still needed</div><button onClick={() => setModal({ kind: "requirement" })} className="flex h-9 items-center gap-1.5 bg-[#ed6a5a] px-3 text-[10px] font-bold text-white"><Plus size={14}/>Add requirement</button></div></div>
        <div className="space-y-5">
          {groupedRequirements.map(({ client, items }) => {
            const received = items.filter((item) => item.status === "Received").length;
            const progress = Math.round((received / items.length) * 100);
            return <section key={client} className="border border-[#e4e8ed] bg-white">
              <header className="flex flex-col gap-3 border-b border-[#edf0f3] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="min-w-0"><h4 className="truncate text-sm font-bold text-[#273449]">{client}</h4><p className="mt-0.5 text-[10px] text-[#8d96a5]">{received} of {items.length} received</p></div><div className="flex items-center gap-3"><div className="h-1.5 w-28 overflow-hidden rounded-full bg-[#eef1f4]"><div className="h-full rounded-full bg-[#76a987]" style={{ width: `${progress}%` }}/></div><span className="w-8 text-right text-[10px] font-bold text-[#6c7788]">{progress}%</span><button onClick={() => setModal({ kind: "task", client })} className="grid h-8 w-8 place-items-center border border-[#e3e7ec] text-[#7d8795] hover:bg-[#f6f7f9]" aria-label={`Add follow-up task for ${client}`} title="Add follow-up task"><Plus size={15}/></button></div></header>
              <div>{items.map((item) => <article key={item.id} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#f0f2f4] px-4 py-3 last:border-0 sm:grid-cols-[24px_minmax(0,1fr)_140px_110px_118px] sm:px-5">
                <span className={`grid h-6 w-6 place-items-center rounded-full ${item.status === "Received" ? "bg-[#eaf5ee] text-[#4e8b63]" : item.status === "In progress" ? "bg-[#fff2e8] text-[#bb7649]" : "bg-[#f1f3f6] text-[#8b95a3]"}`}>{item.status === "Received" ? <Check size={13}/> : <Circle size={11}/>}</span>
                <div className="min-w-0"><button onClick={() => setModal({ kind: "requirement", item })} className={`block max-w-full truncate text-left text-xs font-semibold hover:text-[#c35d51] ${item.status === "Received" ? "text-[#8f98a6] line-through" : "text-[#354258]"}`}>{item.title}</button><p className="mt-0.5 text-[10px] text-[#939baa]">{item.team} · {item.owner} · Due {dateLabel(item.due)}</p><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#7d8795]">{item.details}{item.comments ? ` · ${item.comments}` : ""}{item.attachments.length ? ` · ${item.attachments.length} attachment link${item.attachments.length === 1 ? "" : "s"}` : ""}</p></div>
                <p className="hidden text-[10px] font-semibold text-[#717d8f] sm:block">Due {dateLabel(item.due)}</p>
                <span className={`hidden w-fit rounded px-2 py-1 text-[9px] font-bold sm:inline-block ${item.status === "Received" ? "bg-[#eaf5ee] text-[#4e8b63]" : item.status === "In progress" ? "bg-[#fff2e8] text-[#b66b3f]" : "bg-[#f1f3f6] text-[#657286]"}`}>{item.status}</span>
                <button onClick={() => updateRequirement(item)} className="col-start-3 row-start-1 flex h-8 items-center justify-center gap-1.5 border border-[#e1e5ea] px-2 text-[9px] font-bold text-[#637084] hover:border-[#c5ccd5] sm:col-start-auto sm:row-auto">Update status <ChevronDown size={12}/></button>
              </article>)}</div>
            </section>;
          })}
        </div>
      </section>}

      {activeTab === "Calendar" && <section>
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2"><div className="flex items-center"><button onClick={() => moveCalendar(-1)} aria-label="Previous calendar period" className="grid h-9 w-9 place-items-center border border-[#dfe4ea] bg-white text-[#667286] hover:bg-[#f6f7f9]"><ChevronLeft size={16}/></button><button onClick={() => setCalendarDate(new Date())} className="h-9 border-y border-[#dfe4ea] bg-white px-3 text-[11px] font-bold text-[#596579] hover:bg-[#f6f7f9]">Today</button><button onClick={() => moveCalendar(1)} aria-label="Next calendar period" className="grid h-9 w-9 place-items-center border border-[#dfe4ea] bg-white text-[#667286] hover:bg-[#f6f7f9]"><ChevronRight size={16}/></button></div><h3 className="ml-1 text-sm font-bold text-[#273449]">{calendarTitle}</h3></div>
          <div className="flex items-center justify-between gap-3 sm:justify-end"><div className="flex border border-[#dfe4ea] bg-white p-0.5" role="group" aria-label="Calendar view">{(["Day", "Week", "Month"] as CalendarMode[]).map((mode) => <button key={mode} aria-pressed={calendarMode === mode} onClick={() => setCalendarMode(mode)} className={`h-7 px-3 text-[10px] font-bold ${calendarMode === mode ? "bg-[#17253a] text-white" : "text-[#7b8594] hover:bg-[#f3f5f7]"}`}>{mode}</button>)}</div><button onClick={() => setModal({ kind: "event" })} className="flex h-9 items-center gap-1.5 bg-[#ed6a5a] px-3 text-[10px] font-bold text-white hover:bg-[#dc5e50]"><Plus size={14}/>Schedule</button></div>
        </div>
        {calendarMode === "Month" ? <div className="overflow-hidden border border-[#e4e8ed] bg-white">
          <div className="grid grid-cols-7 border-b border-[#e8ebef] bg-[#f8f9fa]">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="px-1 py-2 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-[#8c95a3] sm:py-2.5 sm:text-[10px]">{day}</div>)}</div>
          <div className="grid grid-cols-7">{calendarDays.map((date) => {
            const key = isoDate(date);
            const inMonth = date.getMonth() === calendarDate.getMonth();
            const dayEvents = eventsForDate(key);
            return <div key={key} className={`min-h-[82px] border-b border-r border-[#edf0f3] p-1.5 sm:min-h-[112px] sm:p-2 ${inMonth ? "bg-white" : "bg-[#fafbfc]"}`}>
              <button onClick={() => { setCalendarDate(date); setCalendarMode("Day"); }} className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold ${key === isoDate(calendarDate) ? "bg-[#ed6a5a] text-white" : inMonth ? "text-[#596579] hover:bg-[#f0f2f5]" : "text-[#b2b8c2]"}`}>{date.getDate()}</button>
              <div className="mt-1 space-y-1">{dayEvents.slice(0, 2).map((event) => <button key={event.id} onClick={() => setModal({ kind: "event-detail", item: event })} className={`block w-full truncate border-l-2 px-1 py-1 text-left text-[8px] font-semibold sm:text-[9px] ${event.kind === "Meeting" ? "border-[#ed6a5a] bg-[#fff3f0] text-[#76564f]" : "border-[#6f8eab] bg-[#edf3f8] text-[#536d86]"}`}>{event.startTime} {event.title}</button>)}{dayEvents.length > 2 && <p className="text-[8px] text-[#8992a0]">+{dayEvents.length - 2} more</p>}</div>
            </div>;
          })}</div>
        </div> : <div className="overflow-x-auto border border-[#e4e8ed] bg-white">
          <div className={`grid min-w-[560px] ${calendarMode === "Day" ? "grid-cols-[58px_minmax(0,1fr)]" : "grid-cols-[58px_repeat(7,minmax(90px,1fr))]"}`}>
            <div className="border-b border-r border-[#e8ebef] bg-[#f8f9fa] p-2 text-[9px] font-bold uppercase tracking-[0.08em] text-[#929aa7]">Time</div>
            {calendarDays.map((date) => <div key={isoDate(date)} className={`border-b border-r border-[#e8ebef] px-2 py-2 text-center ${isoDate(date) === isoDate(calendarDate) ? "bg-[#fff8f6]" : "bg-[#f8f9fa]"}`}><p className="text-[9px] font-bold uppercase text-[#8992a0]">{date.toLocaleDateString("en-US", { weekday: "short" })}</p><p className={`mt-0.5 text-sm font-bold ${isoDate(date) === isoDate(calendarDate) ? "text-[#d65f52]" : "text-[#354258]"}`}>{date.getDate()}</p></div>)}
            {Array.from({ length: 10 }, (_, index) => 8 + index).map((hour) => <div key={hour} className="contents"><div className="h-[74px] border-b border-r border-[#edf0f3] px-2 pt-2 text-[9px] font-medium text-[#929aa7]">{String(hour).padStart(2, "0")}:00</div>{calendarDays.map((date) => {
              const key = isoDate(date);
              const hourEvents = eventsForDate(key).filter((event) => Number(event.startTime.slice(0, 2)) === hour);
              return <div key={`${key}-${hour}`} className="h-[74px] border-b border-r border-[#edf0f3] p-1">{hourEvents.map((event) => <button key={event.id} onClick={() => setModal({ kind: "event-detail", item: event })} className={`mb-1 block w-full border-l-2 px-1.5 py-1 text-left text-[8px] leading-3 sm:text-[9px] ${event.kind === "Meeting" ? "border-[#ed6a5a] bg-[#fff2ee] text-[#72514b]" : "border-[#6f8eab] bg-[#edf3f8] text-[#536d86]"}`}><span className="block font-bold">{event.startTime} · {event.title}</span><span className={`hidden truncate sm:block ${event.kind === "Meeting" ? "text-[#9a746c]" : "text-[#71869a]"}`}>{event.client}</span></button>)}</div>;
            })}</div>)}
          </div>
        </div>}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#e4e8ed] pt-3 text-[10px] font-semibold text-[#7f8998]"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 bg-[#ed6a5a]"/>Client meeting</span><span className="inline-flex items-center gap-2"><span className="h-2 w-2 bg-[#6f8eab]"/>Call / reminder</span><span className="ml-auto">{calendarEvents.length} events in this local demo</span></div>
        <div className="mt-5 border-t border-[#e4e8ed] pt-4"><h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#7d8796]">Upcoming events</h4><div className="divide-y divide-[#edf0f3] border-y border-[#edf0f3] bg-white">{calendarEvents.filter((event) => event.date >= isoDate(calendarDate)).sort((first, second) => `${first.date}T${first.startTime}`.localeCompare(`${second.date}T${second.startTime}`)).slice(0, 5).map((event) => <button key={event.id} onClick={() => setModal({ kind: "event-detail", item: event })} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-[#fafbfc]"><span className="w-14 shrink-0 text-[10px] font-bold text-[#d65f52]">{dateLabel(event.date)}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-[#354258]">{event.title}</span><span className="mt-0.5 block truncate text-[10px] text-[#8b95a4]">{event.client} · {event.owner}</span></span><span className="shrink-0 text-[10px] font-semibold text-[#657286]">{event.startTime}</span></button>)}{calendarEvents.length === 0 && <p className="px-4 py-6 text-center text-xs text-[#8b95a4]">No events scheduled.</p>}</div></div>
      </section>}

      {modal && <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-[#17253a]/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
        {modal.kind === "task" && <form onSubmit={saveTask} className="my-auto w-full max-w-[540px] border border-[#e4e8ed] bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#ed6a5a]">{modal.item ? "Edit task" : "New task"}</p><h3 className="mt-1 text-lg font-bold text-[#17253a]">{modal.item ? "Update task details" : "Add work to your list"}</h3></div><button type="button" onClick={() => setModal(null)} aria-label="Close task form" className="grid h-8 w-8 place-items-center text-[#8791a0] hover:bg-[#f1f3f6]"><X size={17}/></button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Task name"><input name="title" required defaultValue={modal.item?.title} placeholder="e.g. Send proposal" className={inputClass()}/></Field><Field label="Client"><select name="client" defaultValue={modal.item?.client ?? modal.client ?? clients[0]} className={inputClass()}>{clients.map((client) => <option key={client}>{client}</option>)}</select></Field><Field label="Assigned employee"><select name="assignee" defaultValue={modal.item?.assignee ?? people[0]} className={inputClass()}>{people.map((person) => <option key={person}>{person}</option>)}</select></Field><Field label="Assigned team"><select name="team" defaultValue={modal.item?.team ?? "Sales"} className={inputClass()}><option>Sales</option><option>Customer success</option><option>Operations</option><option>Development</option><option>Design</option><option>Marketing</option></select></Field><Field label="Start date"><input name="start" type="date" required defaultValue={modal.item?.start ?? "2026-11-22"} className={inputClass()}/></Field><Field label="Due date"><input name="due" type="date" required defaultValue={modal.item?.due ?? "2026-11-24"} className={inputClass()}/></Field><Field label="Priority"><select name="priority" defaultValue={modal.item?.priority ?? "Normal"} className={inputClass()}>{(["Urgent", "High", "Normal", "Low"] as Priority[]).map((priority) => <option key={priority}>{priority}</option>)}</select></Field><Field label="Status"><select name="status" defaultValue={modal.item?.status ?? "To do"} className={inputClass()}>{(["To do", "In progress", "On hold", "Done"] as TaskStatus[]).map((status) => <option key={status}>{status}</option>)}</select></Field><div className="sm:col-span-2"><Field label="Description"><textarea name="description" rows={2} defaultValue={modal.item?.description} className="w-full rounded-md border border-[#dfe4ea] bg-white px-3 py-2 text-sm"/></Field></div><div className="sm:col-span-2"><Field label="Notes"><textarea name="notes" rows={2} defaultValue={modal.item?.notes} className="w-full rounded-md border border-[#dfe4ea] bg-white px-3 py-2 text-sm"/></Field></div><div className="sm:col-span-2"><Field label="Attachment links (comma separated)"><input name="attachments" defaultValue={modal.item?.attachments.join(", ")} placeholder="https://..." className={inputClass()}/></Field></div><Field label="List"><select name="listId" defaultValue={modal.item?.listId ?? activeListId} className={inputClass()}>{lists.filter((list) => !list.archived).map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></Field><Field label="Assigned by"><input disabled value={modal.item?.assignedBy ?? "Maya Reynolds"} className={`${inputClass()} bg-[#f7f8f9] text-[#7d8795]`}/></Field></div>
          <div className="mt-6 flex justify-between border-t border-[#edf0f3] pt-4"><div>{modal.item && <button type="button" onClick={() => deleteTask(modal.item!)} className="flex h-9 items-center gap-1.5 border border-[#f0d7d3] px-3 text-xs font-bold text-[#b8544b]"><Trash2 size={13}/>Delete task</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setModal(null)} className="h-9 border border-[#dfe4ea] px-3 text-xs font-bold text-[#5f6b7d] hover:bg-[#f6f7f9]">Cancel</button><button className="h-9 bg-[#ed6a5a] px-4 text-xs font-bold text-white hover:bg-[#dc5e50]">{modal.item ? "Save changes" : "Create task"}</button></div></div>
        </form>}
        {modal.kind === "list" && <form onSubmit={saveList} className="my-auto w-full max-w-[420px] border border-[#e4e8ed] bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#ed6a5a]">Task lists</p><h3 className="mt-1 text-lg font-bold text-[#17253a]">{modal.item ? "Rename list" : "Create a list"}</h3></div><button type="button" onClick={() => setModal(null)} aria-label="Close list form" className="grid h-8 w-8 place-items-center text-[#8791a0] hover:bg-[#f1f3f6]"><X size={17}/></button></div>
          <Field label="List name"><input name="name" autoFocus required defaultValue={modal.item?.name} placeholder="e.g. Renewal follow-up" className={`${inputClass()} mt-4`}/></Field>
          <div className="mt-6 flex justify-end gap-2 border-t border-[#edf0f3] pt-4"><button type="button" onClick={() => setModal(null)} className="h-9 border border-[#dfe4ea] px-3 text-xs font-bold text-[#5f6b7d]">Cancel</button><button className="h-9 bg-[#17253a] px-4 text-xs font-bold text-white">{modal.item ? "Save name" : "Create list"}</button></div>
        </form>}
        {modal.kind === "requirement" && <form onSubmit={saveRequirement} className="my-auto w-full max-w-[540px] border border-[#e4e8ed] bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#ed6a5a]">Client requirement</p><h3 className="mt-1 text-lg font-bold text-[#17253a]">{modal.item ? "Edit requirement" : "Add a requirement"}</h3></div><button type="button" onClick={() => setModal(null)} aria-label="Close requirement form" className="grid h-8 w-8 place-items-center text-[#8791a0] hover:bg-[#f1f3f6]"><X size={17}/></button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Client"><select name="client" defaultValue={modal.item?.client ?? modal.client ?? clients[0]} className={inputClass()}>{clients.map((client) => <option key={client}>{client}</option>)}</select></Field><Field label="Requirement"><input name="title" required defaultValue={modal.item?.title} placeholder="e.g. Website development" className={inputClass()}/></Field><Field label="Assigned team"><select name="team" defaultValue={modal.item?.team ?? "Development"} className={inputClass()}><option>Development</option><option>Design</option><option>Marketing</option><option>Sales</option><option>Customer success</option><option>Operations</option></select></Field><Field label="Responsible employee"><select name="owner" defaultValue={modal.item?.owner ?? people[0]} className={inputClass()}>{people.map((person) => <option key={person}>{person}</option>)}</select></Field><Field label="Deadline"><input name="due" type="date" required defaultValue={modal.item?.due ?? "2026-11-30"} className={inputClass()}/></Field><div className="sm:col-span-2"><Field label="Details"><textarea name="details" rows={2} defaultValue={modal.item?.details} className="w-full rounded-md border border-[#dfe4ea] bg-white px-3 py-2 text-sm"/></Field></div><div className="sm:col-span-2"><Field label="Comments and updates"><textarea name="comments" rows={2} defaultValue={modal.item?.comments} className="w-full rounded-md border border-[#dfe4ea] bg-white px-3 py-2 text-sm"/></Field></div><div className="sm:col-span-2"><Field label="Attachment links (comma separated)"><input name="attachments" defaultValue={modal.item?.attachments.join(", ")} placeholder="https://..." className={inputClass()}/></Field></div></div>
          <div className="mt-6 flex justify-end gap-2 border-t border-[#edf0f3] pt-4"><button type="button" onClick={() => setModal(null)} className="h-9 border border-[#dfe4ea] px-3 text-xs font-bold text-[#5f6b7d]">Cancel</button><button className="h-9 bg-[#ed6a5a] px-4 text-xs font-bold text-white">{modal.item ? "Save requirement" : "Add requirement"}</button></div>
        </form>}
        {modal.kind === "event" && <form onSubmit={saveEvent} className="my-auto w-full max-w-[500px] border border-[#e4e8ed] bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#ed6a5a]">Calendar</p><h3 className="mt-1 text-lg font-bold text-[#17253a]">{modal.item ? "Edit event" : "Schedule an event"}</h3></div><button type="button" onClick={() => setModal(null)} aria-label="Close event form" className="grid h-8 w-8 place-items-center text-[#8791a0] hover:bg-[#f1f3f6]"><X size={17}/></button></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Event name"><input name="title" required defaultValue={modal.item?.title} placeholder="e.g. Account review" className={inputClass()}/></Field></div><Field label="Client"><select name="client" defaultValue={modal.item?.client ?? clients[0]} className={inputClass()}>{clients.map((client) => <option key={client}>{client}</option>)}</select></Field><Field label="Assigned employee"><select name="owner" defaultValue={modal.item?.owner ?? people[0]} className={inputClass()}>{people.map((person) => <option key={person}>{person}</option>)}</select></Field><Field label="Date"><input name="date" type="date" required defaultValue={modal.item?.date ?? isoDate(calendarDate)} className={inputClass()}/></Field><Field label="Event type"><select name="kind" defaultValue={modal.item?.kind ?? "Meeting"} className={inputClass()}><option>Meeting</option><option>Call</option><option>Reminder</option></select></Field><Field label="Start time"><input name="startTime" type="time" required defaultValue={modal.item?.startTime ?? "10:00"} className={inputClass()}/></Field><Field label="End time"><input name="endTime" type="time" required defaultValue={modal.item?.endTime ?? "10:30"} className={inputClass()}/></Field><Field label="Location or meeting link"><input name="location" defaultValue={modal.item?.location} placeholder="Room or video URL" className={inputClass()}/></Field><Field label="Reminder"><select name="reminder" defaultValue={modal.item?.reminder?.startsWith("Custom:") ? "Custom" : modal.item?.reminder ?? "30 minutes before"} className={inputClass()}><option>1 day before</option><option>2 hours before</option><option>30 minutes before</option><option value="Custom">Custom interval</option></select></Field><Field label="Custom reminder (minutes)"><input name="customReminderMinutes" type="number" min="1" max="525600" defaultValue={modal.item?.reminder?.match(/\d+/)?.[0] ?? "15"} className={inputClass()}/></Field><div className="sm:col-span-2"><Field label="Participants"><input name="participants" defaultValue={modal.item?.participants} placeholder="Names or email addresses" className={inputClass()}/></Field></div><div className="sm:col-span-2"><Field label="Agenda / description"><textarea name="agenda" rows={3} defaultValue={modal.item?.agenda} className="w-full rounded-md border border-[#dfe4ea] bg-white px-3 py-2 text-sm"/></Field></div></div>
          <div className="mt-6 flex justify-end gap-2 border-t border-[#edf0f3] pt-4"><button type="button" onClick={() => setModal(null)} className="h-9 border border-[#dfe4ea] px-3 text-xs font-bold text-[#5f6b7d]">Cancel</button><button className="h-9 bg-[#ed6a5a] px-4 text-xs font-bold text-white">{modal.item ? "Save event" : "Schedule event"}</button></div>
        </form>}
        {modal.kind === "event-detail" && <article className="my-auto w-full max-w-[420px] border border-[#e4e8ed] bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#ed6a5a]">{modal.item.kind} details</p><h3 className="mt-1 text-lg font-bold text-[#17253a]">{modal.item.title}</h3></div><button type="button" onClick={() => setModal(null)} aria-label="Close event details" className="grid h-8 w-8 place-items-center text-[#8791a0] hover:bg-[#f1f3f6]"><X size={17}/></button></div>
          <div className="mt-5 space-y-3 border-y border-[#edf0f3] py-4 text-xs"><p className="flex items-center gap-2 text-[#596579]"><CalendarDays size={15} className="text-[#8c95a3]"/>{dateLabel(modal.item.date)}, {new Date(`${modal.item.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" })}</p><p className="flex items-center gap-2 text-[#596579]"><Clock3 size={15} className="text-[#8c95a3]"/>{modal.item.startTime}–{modal.item.endTime} · {modal.item.location}</p><p className="flex items-center gap-2 text-[#596579]"><Users size={15} className="text-[#8c95a3]"/>{modal.item.client} · {modal.item.owner}</p><p className="text-[#596579]">Reminder: {modal.item.reminder}</p><p className="text-[#737f90]">{modal.item.agenda}</p><p className="text-[#737f90]">Participants: {modal.item.participants}</p></div>
          <div className="mt-4 flex justify-between"><button onClick={() => { const selectedEvent = modal.item; setModal({ kind: "event", item: selectedEvent }); }} className="flex h-9 items-center gap-2 border border-[#dfe4ea] px-3 text-xs font-bold text-[#5f6b7d]"><Pencil size={13}/>Edit event</button><button onClick={() => { const selectedId = modal.item.id; setCalendarEvents((current) => current.filter((item) => item.id !== selectedId)); setEvents((current) => current.filter((item) => item.id !== selectedId)); setModal(null); }} className="flex h-9 items-center gap-2 border border-[#f0d7d3] px-3 text-xs font-bold text-[#b8544b]"><Trash2 size={13}/>Delete event</button></div>
        </article>}
      </div>}
      <div className="mt-8 flex items-center gap-2 border-t border-[#e4e8ed] pt-3 text-[10px] text-[#99a1ad]"><Circle size={9}/> Changes are saved in this browser and sync across tabs on this device.</div>
    </div>
  );
}