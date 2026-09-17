// components/notifications/NotificationHeader.jsx
"use client";

import Button from "@/components/ui/Button";

export default function NotificationHeader({
  unread,
  onMarkAll,
  onClear,
}) {
  return (
    <div className="border-b border-[var(--border)] p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-[var(--foreground)]">
            Notifications
          </h3>

          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {unread} unread notification{unread !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onMarkAll}
          >
            Read all
          </Button>

          <Button
            size="sm"
            variant="danger"
            onClick={onClear}
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}