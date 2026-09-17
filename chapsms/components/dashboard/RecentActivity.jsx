// components/dashboard/RecentActivity.jsx
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import Card from "@/components/ui/Card";
import { recentActivity } from "@/data/dashboard/activity";

const icons = {
  success: CheckCircle2,
  warning: Clock3,
  danger: XCircle,
};

const colors = {
  success: "text-green-600 bg-green-100 dark:bg-green-950",
  warning: "text-amber-600 bg-amber-100 dark:bg-amber-950",
  danger: "text-red-600 bg-red-100 dark:bg-red-950",
};

export default function RecentActivity() {
  return (
    <Card>
      <h3 className="text-lg font-black text-[var(--foreground)]">
        Recent Activity
      </h3>

      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Latest account and OTP events.
      </p>

      <div className="mt-6 space-y-5">
        {recentActivity.map((item) => {
          const Icon = icons[item.status];

          return (
            <div key={item.id} className="flex gap-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors[item.status]}`}
              >
                <Icon size={18} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                  <h4 className="font-bold text-[var(--foreground)]">
                    {item.title}
                  </h4>
                  <span className="text-xs font-bold text-[var(--muted-foreground)]">
                    {item.time}
                  </span>
                </div>

                <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}