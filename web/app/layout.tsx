import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { MainnetBanner } from "@/components/MainnetBanner";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { NetworkSwitcher } from "@/components/NetworkSwitcher";
import { Atmosphere } from "@/components/Atmosphere";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
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
  "Session keys for agents that the contract itself enforces. VOID compiles a spending policy into an on-chain ERC-4337 validator. Outside it, the agent cannot produce a signature the contract will accept.";

export const metadata: Metadata = {
  title: "VOID | Session Vaults",
  description,
  openGraph: {
    title: "VOID | Session Vaults",
    description,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "VOID | Session Vaults",
    description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${inter.variable} ${plexMono.variable}`}>
      <body className="min-h-screen font-sans text-void-text antialiased">
        <Atmosphere />
        <Providers>
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col">
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-void-border bg-void-bg/40 px-6 py-4 backdrop-blur-xl">
              <Link href="/" className="flex items-baseline gap-2">
                <span className="font-mono text-lg font-semibold tracking-tight text-void-text">
                  VOID
                </span>
                <span className="hidden text-xs text-void-dim sm:inline">
                  session vaults for autonomous agents
                </span>
              </Link>
              <div className="flex items-center gap-3">
                <Link href="/agent" className="hidden text-xs text-void-muted hover:text-void-text sm:inline">
                  Agent run
                </Link>
                <NetworkSwitcher />
                <ConnectWalletButton />
              </div>
            </header>
            <MainnetBanner />
            <main className="flex-1 px-6 py-8">{children}</main>
            <footer className="border-t border-void-border px-6 py-4 text-xs text-void-dim">
              PolicyValidator enforces every action on-chain. This dashboard only reads and relays.
              It is never the thing standing between an agent and your funds.
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
