import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FoodGuard — Make informed food choices",
  description:
    "Scan, understand, and make better-informed choices about the products you use.",
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
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#16a36a",
              colorBackground: "#ffffff",
              borderRadius: "0.75rem",
            },
          }}
        >
          <FirebaseAnalytics />
          <ThemeProvider>
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
