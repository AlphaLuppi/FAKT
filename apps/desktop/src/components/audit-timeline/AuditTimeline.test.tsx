import type { SignatureEvent } from "@fakt/shared";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AuditTimeline } from "./AuditTimeline.js";

function wrap(ui: React.ReactElement): React.ReactElement {
  return <MemoryRouter>{ui}</MemoryRouter>;
}

const FIXTURE_EVENTS: SignatureEvent[] = [
  {
    id: "evt-1",
    documentType: "quote",
    documentId: "doc-1",
    signerName: "Tom Andrieu",
    signerEmail: "tom@alphaluppi.com",
    ipAddress: "127.0.0.1",
    userAgent: "FAKT/0.1.0",
    timestamp: 1_714_000_000_000,
    docHashBefore: "a".repeat(64),
    docHashAfter: "b".repeat(64),
    signaturePngBase64: "iVBOR",
    previousEventHash: null,
    tsaResponse: null,
    tsaProvider: "https://freetsa.org/tsr",
  },
];

describe("AuditTimeline", () => {
  it("rend l'état vide si aucune entrée", () => {
    render(
      wrap(<AuditTimeline docType="quote" docId="doc-1" initialEvents={[]} extraEntries={[]} />)
    );
    expect(screen.getByTestId("audit-timeline-empty")).toBeInTheDocument();
  });

  it("rend une entrée signée avec bouton Vérifier", () => {
    render(
      wrap(
        <AuditTimeline
          docType="quote"
          docId="doc-1"
          initialEvents={FIXTURE_EVENTS}
          extraEntries={[]}
        />
      )
    );
    expect(screen.getByTestId("audit-entry-signed")).toBeInTheDocument();
    expect(screen.getByTestId("audit-verify")).toBeInTheDocument();
    expect(screen.getByText(/Tom Andrieu/)).toBeInTheDocument();
    expect(screen.getByText(/freetsa\.org/)).toBeInTheDocument();
  });

  it("combine extraEntries et events triés par timestamp", () => {
    render(
      wrap(
        <AuditTimeline
          docType="quote"
          docId="doc-1"
          initialEvents={FIXTURE_EVENTS}
          extraEntries={[
            { kind: "created", timestamp: 1_713_999_999_000 },
            { kind: "sent", timestamp: 1_713_999_999_500 },
          ]}
        />
      )
    );
    expect(screen.getByTestId("audit-entry-created")).toBeInTheDocument();
    expect(screen.getByTestId("audit-entry-sent")).toBeInTheDocument();
    expect(screen.getByTestId("audit-entry-signed")).toBeInTheDocument();
  });
});
