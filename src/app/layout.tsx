import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/app/theme-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Material Test Analyzer",
  description:
    "Calibrated-instrument-class materials testing analyzer for stress-strain, puncture, tear and cling curves.",
  keywords: [
    "Material Test Analyzer",
    "Stress-Strain",
    "Puncture",
    "Tear",
    "Cling",
    "Polymer Film",
    "Materials Testing",
  ],
  authors: [{ name: "MZN Labs" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.ico",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E8A8F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('mta-theme') || 'system';
                  var theme = JSON.parse(stored);
                  var mode = (theme && theme.state && theme.state.theme) || 'system';
                  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var isDark = mode === 'dark' || (mode === 'system' && systemDark);
                  if (isDark) document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
                } catch (e) {
                  var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (sysDark) document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = sysDark ? 'dark' : 'light';
                }
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  // Detect base path from the current URL to support GitHub Pages subpath
                  var path = window.location.pathname;
                  // The SW is always at /BASE/sw.js — use the pathname up to the last known segment
                  var swPath = path.substring(0, path.lastIndexOf('/')) + '/sw.js';
                  // If we're at root, swPath would be '/sw.js'
                  if (swPath === '/sw.js' || swPath === '//sw.js') swPath = '/sw.js';
                  navigator.serviceWorker.register(swPath).catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground font-sans`}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
