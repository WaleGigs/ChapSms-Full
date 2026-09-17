import { cn } from "@/lib/utils";
export default function Section({ children, id, className = "" }) {
  return (
    <section id={id} className={cn("px-6 py-20", className)}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}