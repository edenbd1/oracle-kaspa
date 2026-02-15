'use client';

import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-3">How Threshold Works</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Threshold is a decentralized prediction market on Kaspa. Bet on asset prices using real-time oracle data, with shares represented as KRC-20 tokens on-chain.
        </p>
      </div>

      {/* Overview */}
      <Section title="Overview">
        <p>
          Threshold lets you trade on future price outcomes. Each market poses a simple question like
          <strong> &ldquo;Will BTC reach $100,000 before March 1?&rdquo;</strong>
        </p>
        <p>
          You buy <strong>YES</strong> if you think it will, or <strong>NO</strong> if you think it won&apos;t.
          When the market resolves, winning shares pay <strong>1 KAS each</strong>. Losing shares are worth nothing.
        </p>
        <p>
          Prices between 0 and 1 KAS reflect the market&apos;s implied probability. A YES share at 0.70 KAS means
          the market thinks there&apos;s a 70% chance the outcome happens.
        </p>
      </Section>

      {/* How to Trade */}
      <Section title="How to Trade">
        <ol className="list-decimal list-inside space-y-3">
          <li>
            <strong>Connect your wallet</strong> &mdash; Kasware or Kastle (Kaspa testnet-10)
          </li>
          <li>
            <strong>Pick a market</strong> &mdash; Choose an asset and price threshold
          </li>
          <li>
            <strong>Buy shares</strong> &mdash; Enter a KAS amount, choose YES or NO, and confirm the transaction in your wallet
          </li>
          <li>
            <strong>Hold or sell</strong> &mdash; Share prices move with demand. Sell anytime before resolution
          </li>
          <li>
            <strong>Resolution</strong> &mdash; When the deadline passes, the oracle determines the outcome. Winning shares pay 1 KAS each
          </li>
        </ol>
      </Section>

      {/* Oracle */}
      <Section title="The Oracle">
        <p>
          The oracle fetches live prices for BTC, ETH, and KAS from multiple sources
          (CoinGecko, CoinMarketCap) every <strong>15 seconds</strong>.
        </p>
        <p>
          It computes a median-based index, filters outliers, and anchors the result to the
          Kaspa blockchain as a CBOR-encoded payload. This creates a tamper-proof, verifiable
          price record that the prediction markets use for resolution.
        </p>
        <div className="bg-card border border-border rounded-lg p-4 font-mono text-sm">
          <div className="text-muted-foreground mb-2">{'// On-chain payload (CBOR, <80 bytes)'}</div>
          <div>{'{'}</div>
          <div className="pl-4">d: 0.0001, <span className="text-muted-foreground">{'// dispersion between sources'}</span></div>
          <div className="pl-4">h: &quot;f4895c91...&quot;, <span className="text-muted-foreground">{'// SHA-256 hash of proof bundle'}</span></div>
          <div className="pl-4">n: 2, <span className="text-muted-foreground">{'// number of valid sources'}</span></div>
          <div className="pl-4">p: 68497.66 <span className="text-muted-foreground">{'// aggregated price (USD)'}</span></div>
          <div>{'}'}</div>
        </div>
      </Section>

      {/* LMSR */}
      <Section title="Pricing: LMSR">
        <p>
          Threshold uses the <strong>Logarithmic Market Scoring Rule (LMSR)</strong> for automated
          market making. Unlike order-book exchanges, LMSR provides continuous liquidity &mdash;
          you can always buy or sell at a fair price.
        </p>
        <p>
          The LMSR formula determines prices based on the current share distribution:
        </p>
        <div className="bg-card border border-border rounded-lg p-4 font-mono text-sm text-center">
          Price(YES) = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
        </div>
        <p>
          Where <code className="text-sm bg-muted px-1.5 py-0.5 rounded">b</code> is the liquidity parameter (higher = more stable prices)
          and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">q</code> values track outstanding shares.
          The more YES shares are bought, the higher the YES price goes.
        </p>
      </Section>

      {/* KRC-20 Tokens */}
      <Section title="KRC-20 Tokens">
        <p>
          Each market has a <strong>YES token</strong> and a <strong>NO token</strong> deployed as
          KRC-20 inscriptions on the Kaspa blockchain. These are real on-chain tokens.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoCard title="Buying" description="When you buy shares, the platform transfers pre-minted KRC-20 tokens to your wallet via a commit-reveal inscription." />
          <InfoCard title="Selling" description="When you sell, tokens are transferred back to the platform pool and your KAS is returned." />
          <InfoCard title="Resolution" description="Winning tokens can be redeemed for 1 KAS each. Losing tokens become worthless." />
          <InfoCard title="Naming" description="Tickers follow the pattern Y/N + ASSET + MONTH + INDEX. Example: YBTCCA = YES BTC March Market A." />
        </div>
      </Section>

      {/* Architecture */}
      <Section title="Architecture">
        <div className="space-y-4">
          <ArchRow
            label="Frontend"
            tech="Next.js + React"
            detail="Vercel. Real-time market data, wallet integration (Kasware/Kastle), trading UI."
          />
          <ArchRow
            label="Backend"
            tech="TypeScript + Node.js"
            detail="Railway. Oracle price loop, PM resolution engine, combined API on single port."
          />
          <ArchRow
            label="Blockchain"
            tech="Kaspa Testnet-10"
            detail="Oracle anchoring, KRC-20 token inscriptions via public Resolver nodes."
          />
          <ArchRow
            label="Pricing"
            tech="Kasplex Protocol"
            detail="KRC-20 deploy, mint, transfer via commit-reveal inscriptions."
          />
        </div>
      </Section>

      {/* API */}
      <Section title="API">
        <p>The backend exposes a public REST API:</p>
        <div className="space-y-2">
          <ApiRow method="GET" path="/health" description="Oracle health status and node info" />
          <ApiRow method="GET" path="/latest" description="Latest price bundle with proof" />
          <ApiRow method="GET" path="/pm/events" description="All events with live oracle prices" />
          <ApiRow method="GET" path="/pm/market/:id" description="Market detail, trades, price history" />
          <ApiRow method="GET" path="/pm/quote?marketId=...&side=YES&action=BUY&kasAmount=10" description="Get a trade quote" />
          <ApiRow method="POST" path="/pm/trade" description="Execute a trade" />
          <ApiRow method="GET" path="/pm/wallet/:address" description="User positions and balance" />
          <ApiRow method="GET" path="/pm/tokens" description="All KRC-20 token info" />
        </div>
      </Section>

      {/* Links */}
      <Section title="Links">
        <div className="flex flex-wrap gap-3">
          <ExtLink href="https://github.com/edenbd1/oracle-kaspa">GitHub Repository</ExtLink>
          <ExtLink href="https://oracle-kaspa-production.up.railway.app/health">Oracle Health</ExtLink>
          <ExtLink href="https://oracle-kaspa-production.up.railway.app/latest">Latest Price</ExtLink>
          <ExtLink href="https://explorer-tn10.kaspa.org">Kaspa Explorer</ExtLink>
          <ExtLink href="https://tn10api.kasplex.org">Kasplex Indexer</ExtLink>
        </div>
      </Section>

      {/* Back */}
      <div className="pt-4 border-t border-border">
        <Link href="/pm" className="text-primary hover:underline text-sm font-medium">
          &larr; Back to Markets
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <div className="space-y-3 text-[15px] text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function InfoCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="font-semibold text-foreground text-sm mb-1">{title}</div>
      <div className="text-muted-foreground text-sm">{description}</div>
    </div>
  );
}

function ArchRow({ label, tech, detail }: { label: string; tech: string; detail: string }) {
  return (
    <div className="flex gap-4 items-start bg-card border border-border rounded-lg p-4">
      <div className="min-w-[90px]">
        <div className="font-semibold text-foreground text-sm">{label}</div>
        <div className="text-xs text-primary">{tech}</div>
      </div>
      <div className="text-sm text-muted-foreground">{detail}</div>
    </div>
  );
}

function ApiRow({ method, path, description }: { method: string; path: string; description: string }) {
  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2.5">
      <span className={`text-xs font-bold px-2 py-0.5 rounded ${method === 'GET' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
        {method}
      </span>
      <code className="text-sm text-foreground font-mono">{path}</code>
      <span className="text-sm text-muted-foreground ml-auto hidden sm:block">{description}</span>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground hover:border-primary/50 transition-colors"
    >
      {children}
      <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}
