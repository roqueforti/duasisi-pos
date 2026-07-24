import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "dua SiSi — Laundry Express & Coin POS",
  description: "Aplikasi POS Laundry Modern & Smart Management System",
  manifest: "/duasisi-pos/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${plusJakartaSans.variable} font-sans bg-slate-50 text-slate-900 antialiased h-full overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}
