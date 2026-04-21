//! PDF module — Typst CLI subprocess integration.
//!
//! Architecture note (§9 of docs/architecture.md):
//!   The original architecture doc states "crate `typst` embarqué" as the
//!   primary option, with a documented fallback to the CLI subprocess if the
//!   embedded crate inflates the bundle beyond 15 MB.
//!
//!   **Decision for W1 (Track C delivery) : CLI subprocess.**
//!
//!   Rationale :
//!   - The embedded `typst` crate pulls ~150+ transitive dependencies
//!     (typst-layout, typst-pdf, typst-syntax, typst-library, ziko, comemo,
//!     font-kit, ttf-parser, …) and adds ~30 MB release binary size.
//!     That exceeds the NFR-003 soft cap on installer size for a feature
//!     that can be deferred to v0.2 optimisation (swap to embedded if
//!     bundle budget permits).
//!   - The Typst CLI is deterministic (identical input → identical PDF
//!     bytes) and already handles fonts, packages, inputs. It gives us
//!     golden-test byte-parity for free.
//!   - Same pattern as Track E (Claude CLI) — consistent cross-module
//!     convention for v0.1 external tooling.
//!
//! The binary path is resolved via the FAKT_TYPST_PATH env var (CI/test
//! mock) or the system `typst` command. In production, we will bundle the
//! typst CLI as a Tauri sidecar binary (§11.1 bundler Tauri) — this module
//! stays source-compatible because it only consults the binary path.

pub mod render;
