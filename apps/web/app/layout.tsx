import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "../lib/auth-context";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "DevTrack",
  description: "Developer productivity platform",
};

// Runs before React hydrates so <html data-theme> is correct on first paint —
// without this, the page would flash the wrong theme for a frame while React
// boots and ThemeToggle instances read localStorage themselves.
const THEME_INIT_SCRIPT = `
  try {
    var stored = localStorage.getItem('devtrack-theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-canvas text-ink`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
