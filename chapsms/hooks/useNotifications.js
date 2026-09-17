"use client";

import { useEffect, useState } from "react";
import { notificationService } from "@/services/notificationService";
import { notificationEventService } from "@/services/notificationEventService";

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    async function loadNotifications() {
      const data = await notificationService.getNotifications();
      setNotifications(data);
    }

    loadNotifications();

    const unsubscribe = notificationEventService.subscribe(async (notification) => {
      const savedNotification =
        await notificationService.addNotification(notification);

      setNotifications((prev) => [savedNotification, ...prev]);
    });

    return unsubscribe;
  }, []);

  async function markAsRead(id) {
    await notificationService.markAsRead(id);

    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, read: true } : item
      )
    );
  }

  async function markAllAsRead() {
    await notificationService.markAllAsRead();

    setNotifications((prev) =>
      prev.map((item) => ({ ...item, read: true }))
    );
  }

  async function clearAll() {
    await notificationService.clearAll();
    setNotifications([]);
  }

  const unreadCount = notifications.filter((item) => !item.read).length;

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}