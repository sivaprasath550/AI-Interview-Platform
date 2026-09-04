import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthInitializer } from "@/components/auth-initializer";
import { QueryProvider } from "@/components/query-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
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
  title: {
    default: "InterviewLab — practice coding interviews that run your code",
    template: "%s · InterviewLab",
  },
  description:
    "Solve curated coding-interview problems and get real verdicts: every submission runs in an isolated sandbox against hidden tests.",
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
    >
      <body className="flex min-h-dvh flex-col bg-bg text-text">
        <QueryProvider>
          <AuthInitializer />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </QueryProvider>
      </body>
    </html>
  );
}
