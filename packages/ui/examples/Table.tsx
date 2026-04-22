import type { ReactElement } from "react";
import { StatusPill } from "../src/data-display/StatusPill.js";
import type { StatusKind } from "../src/data-display/StatusPill.js";
import { Table } from "../src/data-display/Table.js";

interface Row {
  num: string;
  client: string;
  amount: number;
  status: StatusKind;
  issued: string;
}

const ROWS: Row[] = [
  {
    num: "D2026-001",
    client: "Atelier Mercier",
    amount: 4200,
    status: "signed",
    issued: "2026-04-03",
  },
  { num: "D2026-002", client: "Studio Orion", amount: 6800, status: "sent", issued: "2026-04-08" },
  {
    num: "D2026-003",
    client: "Cabinet Levant",
    amount: 2100,
    status: "draft",
    issued: "2026-04-12",
  },
];

export function TableExample(): ReactElement {
  return (
    <div style={{ padding: 24 }}>
      <Table
        rows={ROWS}
        getRowId={(r) => r.num}
        columns={[
          {
            id: "num",
            header: "N°",
            accessor: (r) => r.num,
            sortable: true,
            sortValue: (r) => r.num,
          },
          {
            id: "client",
            header: "Client",
            accessor: (r) => r.client,
            sortable: true,
            sortValue: (r) => r.client,
          },
          {
            id: "issued",
            header: "Émis",
            accessor: (r) => r.issued,
            sortable: true,
            sortValue: (r) => r.issued,
          },
          {
            id: "status",
            header: "Statut",
            accessor: (r) => <StatusPill status={r.status} size="sm" />,
          },
          {
            id: "amount",
            header: "Montant HT",
            align: "right",
            accessor: (r) => `${r.amount.toLocaleString("fr-FR")} €`,
            sortable: true,
            sortValue: (r) => r.amount,
          },
        ]}
      />
    </div>
  );
}
