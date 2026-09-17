import {
  Suspense,
} from "react";

import VerifyEmailContent from "./VerifyEmailContent";

function LoadingVerification() {
  return (
    <div className="flex min-h-64 items-center justify-center text-sm font-semibold text-[var(--muted-foreground)]">
      Loading verification…
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <LoadingVerification />
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
