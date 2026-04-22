import type { SignatureEvent } from "@fakt/shared";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type SignatureApi,
  type VerifyReport,
  setSignatureApi,
} from "../../features/doc-editor/signature-api.js";
import { VerifyRoute } from "./Verify.js";

const EVENT_ID = "evt-verify-1";

function buildApi(report: VerifyReport, events: SignatureEvent[]): SignatureApi {
  return {
    sign: vi.fn(),
    listEvents: vi.fn(async () => events),
    verify: vi.fn(async () => report),
    appendEvent: vi.fn(),
    storeSignedPdf: vi.fn(),
    getSignedPdf: vi.fn(async () => null),
  };
}

function renderRoute(api: SignatureApi): void {
  setSignatureApi(api);
  render(
    <MemoryRouter initialEntries={[`/signatures/${EVENT_ID}/verify`]}>
      <Routes>
        <Route path="/signatures/:eventId/verify" element={<VerifyRoute />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  setSignatureApi(null);
});

describe("VerifyRoute", () => {
  it("affiche un statut Intégrité OK", async () => {
    const report: VerifyReport = {
      eventId: EVENT_ID,
      documentType: "quote",
      documentId: "doc-1",
      integrityOk: true,
      chainOk: true,
      chainLength: 1,
      brokenChainIndices: [],
      docHashBefore: "a".repeat(64),
      docHashAfter: "b".repeat(64),
      tsaProvider: "https://freetsa.org/tsr",
      signerName: "Tom",
      signerEmail: "tom@alphaluppi.com",
      timestampIso: "2026-04-22T12:00:00Z",
      padesLevel: "B-T",
    };
    const event: SignatureEvent = {
      id: EVENT_ID,
      documentType: "quote",
      documentId: "doc-1",
      signerName: "Tom",
      signerEmail: "tom@alphaluppi.com",
      ipAddress: null,
      userAgent: null,
      timestamp: Date.parse(report.timestampIso),
      docHashBefore: report.docHashBefore,
      docHashAfter: report.docHashAfter,
      signaturePngBase64: "iVBOR",
      previousEventHash: null,
      tsaResponse: null,
      tsaProvider: report.tsaProvider,
    };
    renderRoute(buildApi(report, [event]));
    await waitFor(() => expect(screen.getByTestId("verify-document")).toBeInTheDocument());
    expect(screen.getByTestId("verify-signature")).toBeInTheDocument();
    expect(screen.getByTestId("verify-integrity")).toBeInTheDocument();
    expect(screen.getByTestId("verify-chain")).toBeInTheDocument();
    expect(screen.getByText(/PAdES-B-T/)).toBeInTheDocument();
    expect(screen.getAllByText(/Intégrité vérifiée/).length).toBeGreaterThan(0);
  });

  it("affiche un statut Hash divergent en cas d'intégrité cassée", async () => {
    const report: VerifyReport = {
      eventId: EVENT_ID,
      documentType: "invoice",
      documentId: "doc-2",
      integrityOk: false,
      chainOk: false,
      chainLength: 2,
      brokenChainIndices: [1],
      docHashBefore: "c".repeat(64),
      docHashAfter: "d".repeat(64),
      tsaProvider: null,
      signerName: "Tom",
      signerEmail: "tom@alphaluppi.com",
      timestampIso: "2026-04-22T13:00:00Z",
      padesLevel: "B",
    };
    renderRoute(buildApi(report, []));
    await waitFor(() => expect(screen.getByTestId("verify-integrity")).toBeInTheDocument());
    expect(screen.getAllByText(/Hash divergent/).length).toBeGreaterThan(0);
  });

  it("affiche une erreur si la commande échoue", async () => {
    const api = {
      sign: vi.fn(),
      listEvents: vi.fn(async () => []),
      verify: vi.fn(async () => {
        throw new Error("event introuvable");
      }),
      appendEvent: vi.fn(),
      storeSignedPdf: vi.fn(),
      getSignedPdf: vi.fn(async () => null),
    } satisfies SignatureApi;
    renderRoute(api);
    await waitFor(() => expect(screen.getByTestId("verify-error")).toBeInTheDocument());
  });
});
