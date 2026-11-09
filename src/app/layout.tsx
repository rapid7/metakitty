import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteNav } from "@/components/site-nav";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "metasploit-framework dashboard",
  description: "Open pull request queue and historical stats for the rapid7 Metasploit project repos.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="antialiased">
        <TooltipProvider>
          <SiteNav />
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
