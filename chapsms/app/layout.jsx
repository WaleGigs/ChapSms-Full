import "./globals.css";

import { Suspense } from "react";
import { AuthProvider } from "@/context/AuthContext";
import ThemeProvider from "@/components/ThemeProvider";
import { Toaster } from "react-hot-toast";
import TikTokPixel from "@/components/analytics/TikTokPixel";
import SnapPixel, { SnapPageViews } from "@/components/analytics/SnapPixel";
import AcquisitionCapture from "@/components/analytics/AcquisitionCapture";

export const metadata = {
  title: "ChapsSmS",
  description: "Virtual numbers for SMS OTP verification",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <TikTokPixel />
        <SnapPixel />
      </head>
      <body>
        <Suspense fallback={null}>
          <AcquisitionCapture />
          <SnapPageViews />
        </Suspense>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
