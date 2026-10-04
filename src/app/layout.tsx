import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Know What's Inside — Product Ingredient Analysis",
  description:
    "Understand ingredients in food, cosmetics, skincare, and everyday products.",
};

// The WebView host is edge-to-edge (the Android native layer draws the WebView
// behind the status bar and pads its top via WindowInsets), so we opt into
// viewport-fit=cover to let the browser report the real insets via
// env(safe-area-inset-*). That is what powers the bottom safe-area padding.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <FirebaseAnalytics />
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
