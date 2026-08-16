import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { DialogProvider } from "@/components/DialogProvider";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "dua SiSi — Laundry Express & Coin POS",
  description: "Aplikasi POS Laundry Modern & Smart Management System",
  manifest: "/manifest.json",
  icons: {
    icon: "/assets/icon-192.svg",
    apple: "/assets/icon-512.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self' https://script.google.com https://script.googleusercontent.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://script.google.com https://script.googleusercontent.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://script.google.com https://script.googleusercontent.com; frame-src 'self';"
        />
        <meta name="viewport" content="width=1280, user-scalable=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DuaSiSi POS" />
        <link rel="apple-touch-icon" href="/assets/icon-512.svg" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(registration) {
                      console.log('✅ SW registered:', registration.scope);
                    })
                    .catch(function(error) {
                      console.log('❌ SW registration failed:', error);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body className={`${plusJakartaSans.variable} font-sans bg-[#F8FAFC] text-slate-700 antialiased h-full overflow-hidden`}>
        <DialogProvider>
          {children}
        </DialogProvider>
      </body>
    </html>
  );
}
