# Hacker News — Show HN

**NE PAS POSTER** avant validation du timing par Tom.

Note : Hacker News = anglais obligatoire. Le reste des messages est en français.

---

## Titre (format Show HN)

Show HN: FAKT – Open-source desktop app for French freelancers (invoices + PAdES signing, ~8MB, offline-first)

---

## Premier commentaire — Maker's intro (~500 words)

Hey HN,

I'm Tom Andrieu, a freelance developer and designer in Avignon, France. I built FAKT (https://github.com/AlphaLuppi/FAKT) to replace my patchwork of 6 tools for billing cycle management with a single ~8MB Tauri binary.

**The problem it solves**

French freelancers have unusually specific legal requirements: sequential invoice numbering without gaps (CGI art. 289), mandatory 40€ late payment penalty mention, specific TVA text, 10-year archive obligation. Standard tools like Notion templates or Word docs don't enforce these, and the French SaaS options (Indy, Tiime, Freebe) are cloud-only with your data on their servers.

**The interesting technical parts**

1. **DIY PAdES signing in Rust.** Rather than integrate Yousign or Docusign, I implemented eIDAS AdES-B-T signing myself: RSA-4096 key in OS keychain (via `keyring` crate), SHA-256 hash, RFC 3161 timestamping via FreeTSA, CMS structure embedded in PDF via `lopdf`. The signed PDF validates in Adobe Reader. 100% offline except for the TSA call. The whole crypto pipeline is in `apps/desktop/src-tauri/src/crypto/`.

2. **Typst for deterministic PDF.** I avoided Puppeteer/headless Chrome entirely. Typst as a subprocess gives reproducible, bit-identical PDFs with French professional templates. 5-10× faster than a browser-based renderer.

3. **Append-only audit trail.** Every signing event is inserted into an append-only SQLite table with a chained SHA-256 hash. SQL trigger prevents UPDATE/DELETE. The chain is verifiable programmatically.

4. **Claude Code CLI subprocess.** FAKT spawns `claude` as a subprocess for brief → invoice/quote extraction and email drafting. The user provides their own Anthropic token — FAKT never touches it. The AI integration uses structured JSON tool-use output, not raw text parsing.

5. **Tauri 2 for the size.** The binary is ~8MB because Tauri uses the OS WebView instead of embedding Chromium. On Windows it requires WebView2 (included in Win11, downloadable for Win10). Compared to Electron at 150MB+, this matters a lot for an installer that people will download on a slow connection.

**Stack**

Tauri 2 (Rust + React webview), Bun workspaces, Drizzle ORM on SQLite, React 19 + Vite + Tailwind v4. Design system "Brutal Invoice" (black ink, off-white paper, pure yellow, Space Grotesk uppercase, flat shadows, zero border-radius). CI: GitHub Actions matrix 3-OS with tauri-action@v2.

**License**

BSL 1.1 → Apache 2.0 on 2030-04-21. Free for personal/organizational use. Prohibits competing SaaS resale for 4 years. Same model as MariaDB, Sentry, HashiCorp Vault before they went proprietary.

**What's next**

v0.2: self-hosted Docker mode with Hono backend + PostgreSQL sync, for agencies with 2-15 users.
v0.3: hosted SaaS (~12€/user/month).

Happy to answer questions about the Tauri architecture, the PAdES implementation, or why we went with Typst over LaTeX/HTML.

Source: https://github.com/AlphaLuppi/FAKT
Landing: https://fakt.alphaluppi.com
