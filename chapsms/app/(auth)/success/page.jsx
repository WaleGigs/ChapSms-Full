// app/(auth)/success/page.jsx
import { CheckCircle2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function SuccessPage() {
  return (
    <Card className="rounded-3xl p-8 text-center shadow-xl">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 text-green-600">
        <CheckCircle2 size={34} />
      </div>

      <h1 className="mt-6 text-3xl font-black text-[var(--foreground)]">
        Successful
      </h1>

      <p className="mt-3 text-[var(--muted)]">
        Your action was completed successfully. You can now continue to your
        account dashboard.
      </p>

      <div className="mt-8">
        <Button href="/dashboard" className="w-full" size="lg">
          Go to Dashboard
        </Button>
      </div>
    </Card>
  );
}