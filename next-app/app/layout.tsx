import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { DialogProvider } from "@/components/DialogProvider";
import { DisplaySettingsProvider } from "@/components/DisplaySettingsContext";

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
          content="default-src 'self' https://script.google.com https://script.googleusercontent.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://script.google.com https://script.googleusercontent.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://script.google.com https://script.googleusercontent.com https:; frame-src 'self' https://www.google.com https://maps.google.com;"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DuaSiSi POS" />
        <link rel="apple-touch-icon" href="/assets/icon-512.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700;800&family=Nunito:wght@300;400;600;700;800&family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Poppins:wght@300;400;500;600;700;800&family=Quicksand:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var saved = localStorage.getItem('duasisi_display_settings');
                if (saved) {
                  var p = JSON.parse(saved);
                  if (p.zoomScale) {
                    var z = p.zoomScale / 100;
                    document.documentElement.style.setProperty('--ui-scale', z.toString());
                    document.documentElement.style.setProperty('--ui-scale-percent', p.zoomScale + '%');
                  }
                  if (p.fontFamily) {
                    document.documentElement.style.setProperty('--font-sans', "'" + p.fontFamily + "', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif");
                  }
                  if (p.density) {
                    document.documentElement.setAttribute('data-density', p.density);
                  }
                  if (p.fontWeightMode) {
                    document.documentElement.setAttribute('data-font-weight', p.fontWeightMode);
                  }
                }
              } catch (e) {}

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
      <body className={`${plusJakartaSans.variable} font-sans bg-[#F8FAFC] text-slate-700 antialiased min-h-screen overflow-y-auto`}>
        <DialogProvider>
          <DisplaySettingsProvider>
            {children}
          </DisplaySettingsProvider>
        </DialogProvider>
      </body>
    </html>
  );
}
