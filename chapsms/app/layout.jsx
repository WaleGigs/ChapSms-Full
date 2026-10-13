import "./globals.css";

import { Suspense } from "react";
import { AuthProvider } from "@/context/AuthContext";
import ThemeProvider from "@/components/ThemeProvider";
import { Toaster } from "react-hot-toast";
import TikTokPixel from "@/components/analytics/TikTokPixel";
import SnapPixel from "@/components/analytics/SnapPixel";

export const metadata = {
  title: "ChapsSmS",
  description: "Virtual numbers for SMS OTP verification",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <TikTokPixel />
      </head>
      <body>
        <Suspense fallback={null}>
          <SnapPixel />
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
