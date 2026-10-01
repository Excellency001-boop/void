import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { NetworkSwitcher } from "@/components/NetworkSwitcher";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const description =
  "Give an AI agent real economic agency without giving it the ability to rug you. Session Vaults compile a spending policy into an on-chain ERC-4337 validator — the agent can't produce a valid signature for anything outside it.";

export const metadata: Metadata = {
  title: "VOID — Session Vaults",
  description,
  openGraph: {
    title: "VOID — Session Vaults",
    description,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "VOID — Session Vaults",
    description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${plexMono.variable}`}>
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
              <div className="flex items-center gap-3">
                <NetworkSwitcher />
                <ConnectWalletButton />
              </div>
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
