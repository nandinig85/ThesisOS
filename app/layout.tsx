import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThesisOS — Live investment intelligence",
  description: "Source-linked market intelligence for investment theses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
