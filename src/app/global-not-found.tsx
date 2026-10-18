import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Not found" };

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen grid place-items-center bg-background text-foreground font-sans">
        <div className="text-center space-y-3 px-6">
          <p className="font-mono text-sm text-muted-foreground">404</p>
          <h1 className="text-2xl font-semibold tracking-tight">This page doesn&rsquo;t exist</h1>
          <a href="/" className="text-sm underline underline-offset-4">
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
