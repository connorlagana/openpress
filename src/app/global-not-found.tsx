import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NotFoundCard } from "@/components/app/not-found-card";
import "./globals.css";

// Bypasses every layout, so fonts must be loaded here too.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "Not found" };

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>
        <NotFoundCard />
      </body>
    </html>
  );
}
