export type WorkNotification = {
	id: string;
	title: string;
	message: string;
	createdAt: string;
	read: boolean;
};

const storageKey = "elestial-work-notifications-v1";
const updateEventName = "elestial-work-notifications-updated";

export function readWorkNotifications(): WorkNotification[] {
	try {
		const saved = localStorage.getItem(storageKey);
		const notifications = saved ? JSON.parse(saved) as WorkNotification[] : [];
		return Array.isArray(notifications) ? notifications : [];
	} catch {
		return [];
	}
}

export function publishWorkNotification(title: string, message: string) {
	try {
		const notifications = readWorkNotifications();
		const next = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title, message, createdAt: new Date().toISOString(), read: false }, ...notifications].slice(0, 50);
		localStorage.setItem(storageKey, JSON.stringify(next));
		window.dispatchEvent(new Event(updateEventName));
	} catch {
		return;
	}
}

export function markWorkNotificationsRead() {
	try {
		const notifications = readWorkNotifications().map((notification) => ({ ...notification, read: true }));
		localStorage.setItem(storageKey, JSON.stringify(notifications));
		window.dispatchEvent(new Event(updateEventName));
	} catch {
		return;
	}
}

export function workNotificationsUpdateEvent() {
	return updateEventName;
}
