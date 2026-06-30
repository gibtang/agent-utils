import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.agent-utils.com"),
  title: "AgentUtils — API Utilities for AI Agents",
  description: "One API key. Production-ready dead letter queues, human-in-the-loop gates, and audit trails. No SDKs, just curl and go.",
  keywords: ["ai agents", "dead letter queue", "human in the loop", "agent infrastructure", "api utilities"],
  openGraph: {
    title: "AgentUtils — API Utilities for AI Agents",
    description: "Production-ready dead letter queues, human-in-the-loop gates, and audit trails—all behind a single API key.",
    siteName: "AgentUtils",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentUtils — API Utilities for AI Agents",
    description: "Production-ready dead letter queues, human-in-the-loop gates, and audit trails—all behind a single API key.",
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-space-black text-on-surface">
          {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
            <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
          )}
          <AuthProvider>
            {children}
          </AuthProvider>
          <Footer />
      </body>
    </html>
  );
}
