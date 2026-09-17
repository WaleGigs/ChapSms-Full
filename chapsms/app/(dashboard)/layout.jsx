import ProtectedRoute from "@/components/auth/ProtectedRoute";
import DashboardShell from "@/components/dashboard/DashboardShell";
import WelcomeNoticeModal from "@/components/dashboard/WelcomeNoticeModal";
import { WalletProvider } from "@/context/WalletContext";

export default function DashboardLayout({
  children,
}) {
  return (
    <ProtectedRoute>
      <WalletProvider>
        {/*
         * Render the actual application shell first.
         * Wallet/order requests may continue in the background, but the
         * authenticated customer should see the dashboard immediately.
         */}
        <DashboardShell>
          {children}
        </DashboardShell>

        {/*
         * The announcement is intentionally after the shell and also
         * self-defers in its effect, so it cannot be part of the initial
         * "successful login -> dashboard paint" critical path.
         */}
        <WelcomeNoticeModal />
      </WalletProvider>
    </ProtectedRoute>
  );
}
