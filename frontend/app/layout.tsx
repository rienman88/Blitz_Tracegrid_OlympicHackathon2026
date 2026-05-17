import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TraceGrid AI",
  description: "Visible causal execution graph for software behavior."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
