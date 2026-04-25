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
      wrap(
        <AuditTimeline
          docType="quote"
          docId="doc-1"
          initialEvents={[]}
          initialActivities={[]}
          extraEntries={[]}
        />
      )
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
          initialActivities={[]}
          extraEntries={[]}
        />
      )
    );
    expect(screen.getByTestId("audit-timeline-entry-signed")).toBeInTheDocument();
    expect(screen.getByTestId("audit-timeline-verify")).toBeInTheDocument();
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
          initialActivities={[]}
          extraEntries={[
            { kind: "created", timestamp: 1_713_999_999_000 },
            { kind: "sent", timestamp: 1_713_999_999_500 },
          ]}
        />
      )
    );
    expect(screen.getByTestId("audit-timeline-entry-created")).toBeInTheDocument();
    expect(screen.getByTestId("audit-timeline-entry-sent")).toBeInTheDocument();
    expect(screen.getByTestId("audit-timeline-entry-signed")).toBeInTheDocument();
  });

  it("affiche les activity events (mark sent / unmark sent) en plus des signatures", () => {
    render(
      wrap(
        <AuditTimeline
          docType="quote"
          docId="doc-1"
          initialEvents={[]}
          initialActivities={[
            {
              id: "act-1",
              workspaceId: "ws-1",
              type: "quote_marked_sent",
              entityType: "quote",
              entityId: "doc-1",
              payload: null,
              createdAt: 1_713_999_999_000,
            },
            {
              id: "act-2",
              workspaceId: "ws-1",
              type: "quote_unmarked_sent",
              entityType: "quote",
              entityId: "doc-1",
              payload: null,
              createdAt: 1_713_999_999_500,
            },
          ]}
          extraEntries={[]}
        />
      )
    );
    expect(screen.getByTestId("audit-timeline-entry-sent")).toBeInTheDocument();
    expect(screen.getByTestId("audit-timeline-entry-unsent")).toBeInTheDocument();
  });

  it("dédoublonne extraEntries.sent quand un activity event sent existe", () => {
    render(
      wrap(
        <AuditTimeline
          docType="quote"
          docId="doc-1"
          initialEvents={[]}
          initialActivities={[
            {
              id: "act-1",
              workspaceId: "ws-1",
              type: "quote_marked_sent",
              entityType: "quote",
              entityId: "doc-1",
              payload: null,
              createdAt: 1_713_999_999_000,
            },
          ]}
          extraEntries={[
            { kind: "created", timestamp: 1_713_999_998_000 },
            // Doublon avec l'activity ci-dessus — doit être filtré.
            { kind: "sent", timestamp: 1_713_999_999_999 },
          ]}
        />
      )
    );
    // Une seule entrée "sent" malgré la double source.
    const sentEntries = screen.getAllByTestId("audit-timeline-entry-sent");
    expect(sentEntries).toHaveLength(1);
    expect(screen.getByTestId("audit-timeline-entry-created")).toBeInTheDocument();
  });
});
