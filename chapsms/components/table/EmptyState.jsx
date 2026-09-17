import Button from "@/components/ui/Button";

export default function EmptyState({
  title = "No data found",
  text = "There are no records to display yet.",
  actionLabel,
  actionHref,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] p-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl dark:bg-blue-950">
        📭
      </div>

      <h3 className="text-lg font-black text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">{text}</p>

      {actionLabel && actionHref && (
        <Button href={actionHref} className="mt-6">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}