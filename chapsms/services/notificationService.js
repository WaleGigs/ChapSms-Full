import { notifications as defaultNotifications } from "@/data/dashboard/notifications";

const STORAGE_KEY = "chapsms-notifications";

function loadNotifications() {
  if (typeof window === "undefined") {
    return [...defaultNotifications];
  }

  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return [...defaultNotifications];
    }
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(defaultNotifications)
  );

  return [...defaultNotifications];
}

let items = loadNotifications();

function saveNotifications() {
  if (typeof window !== "undefined") {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items)
    );
  }
}

export const notificationService = {
  async getNotifications() {
    items = loadNotifications();
    return items;
  },

  async addNotification(notification) {
    const newNotification = {
      id: Date.now(),
      read: false,
      time: "Just now",
      ...notification,
    };

    items = [newNotification, ...items];

    saveNotifications();

    return newNotification;
  },

  async markAsRead(id) {
    items = items.map((item) =>
      item.id === id
        ? {
            ...item,
            read: true,
          }
        : item
    );

    saveNotifications();

    return true;
  },

  async markAllAsRead() {
    items = items.map((item) => ({
      ...item,
      read: true,
    }));

    saveNotifications();

    return true;
  },

  async clearAll() {
    items = [];
    saveNotifications();
    return true;
  },

  async deleteNotification(id) {
    items = items.filter((item) => item.id !== id);
    saveNotifications();
    return true;
  },
};