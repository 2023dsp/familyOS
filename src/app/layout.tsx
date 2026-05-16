import type { Metadata, Viewport } from "next";
import { SwRegister } from "../components/SwRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "FamilyOS — Family operations dashboard",
  description: "A warm, simple, self-hosted dashboard for keeping the household running.",
  manifest: "/manifest.webmanifest",
  applicationName: "FamilyOS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FamilyOS"
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#F2EAD8",
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('familyos-theme');if(t==='dark'){document.documentElement.classList.add('theme-dark');document.documentElement.dataset.theme='dark';}else{document.documentElement.dataset.theme='light';}}catch(e){}})();`
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
