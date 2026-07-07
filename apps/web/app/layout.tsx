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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
