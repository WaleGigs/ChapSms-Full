import Card from "@/components/ui/Card";

export default function StatCard({ value, label }) {
  return (
    <Card className="text-center">
      <h3 className="text-3xl font-bold text-[var(--foreground)]">{value}</h3>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
  {label}
</p>
    </Card>
  );
}