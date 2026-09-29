import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

export const metadata: Metadata = {
  title: "VOID — Session Vaults",
  description: "Give an agent real economic agency without giving it the ability to rug you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans text-void-text antialiased">
        <Providers>
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col">
            <header className="flex items-center justify-between border-b border-void-border px-6 py-4">
              <Link href="/" className="flex items-baseline gap-2">
                <span className="font-mono text-lg font-semibold tracking-tight text-void-text">
                  VOID
                </span>
                <span className="hidden text-xs text-void-dim sm:inline">
                  session vaults for autonomous agents
                </span>
              </Link>
              <ConnectWalletButton />
            </header>
            <main className="flex-1 px-6 py-8">{children}</main>
            <footer className="border-t border-void-border px-6 py-4 text-xs text-void-dim">
              PolicyValidator enforces every action on-chain. This dashboard only reads and relays
              — it is never the thing standing between an agent and your funds.
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
