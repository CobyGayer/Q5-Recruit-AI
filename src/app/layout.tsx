import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
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
  title: "Q5 Recruit AI",
  description: "AI-powered college soccer recruiting platform for coaches",
  metadataBase: new URL("https://q5recruit.ai"),
  openGraph: {
    title: "Q5 Recruit AI",
    description: "AI-powered college soccer recruiting platform for coaches",
    url: "https://q5recruit.ai",
    siteName: "Q5 Recruit AI",
    type: "website",
    images: [
      {
        url: "/brand/og-image.png",
        width: 1200,
        height: 630,
        alt: "Q5 Recruit AI — AI-powered college soccer recruiting",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Q5 Recruit AI",
    description: "AI-powered college soccer recruiting platform for coaches",
    images: ["/brand/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
