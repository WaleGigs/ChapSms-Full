import "./globals.css";

import { AuthProvider } from "@/context/AuthContext";
import ThemeProvider from "@/components/ThemeProvider";
import { Toaster } from "react-hot-toast";
import TikTokPixel from "@/components/analytics/TikTokPixel";
export const metadata = {
  title: "ChapsSmS",
  description:
    "Virtual numbers for SMS OTP verification",
};

export default function RootLayout({
  children,
}) {
  return (
    <html lang="en">
       <head>
        <TikTokPixel />
      </head>
      <body>
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