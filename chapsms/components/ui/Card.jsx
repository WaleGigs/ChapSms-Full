import { cn } from "@/lib/utils";
export default function Card({ children, className = "" }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}