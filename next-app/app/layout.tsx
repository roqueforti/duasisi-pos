import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "dua SiSi — Laundry Express & Coin POS",
  description: "Aplikasi POS Laundry Modern & Smart Management System",
  manifest: "/duasisi-pos/manifest.json",
  icons: {
    icon: "/duasisi-pos/assets/icon-192.svg",
    apple: "/duasisi-pos/assets/icon-512.svg",
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for(let registration of registrations) {
                    registration.unregister();
                  }
                });
              }
              if ('caches' in window) {
                caches.keys().then(function(names) {
                  for (let name of names) {
                    if (name.includes('duasisi-pos-v')) {
                      caches.delete(name);
                    }
                  }
                });
              }
            `,
          }}
        />
      </head>
      <body className={`${plusJakartaSans.variable} font-sans bg-slate-50 text-slate-900 antialiased h-full overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}
