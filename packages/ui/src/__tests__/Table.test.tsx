import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Table } from "../data-display/Table.js";

interface Row {
  id: string;
  name: string;
  amount: number;
}

const ROWS: Row[] = [
  { id: "1", name: "Bravo", amount: 200 },
  { id: "2", name: "Alpha", amount: 500 },
  { id: "3", name: "Charlie", amount: 100 },
];

const COLS = [
  {
    id: "name",
    header: "Nom",
    accessor: (r: Row) => r.name,
    sortable: true,
    sortValue: (r: Row) => r.name,
  },
  {
    id: "amount",
    header: "Montant",
    accessor: (r: Row) => `${r.amount} €`,
    sortable: true,
    sortValue: (r: Row) => r.amount,
  },
];

describe("Table", () => {
  it("rend les lignes", () => {
    render(<Table rows={ROWS} columns={COLS} getRowId={(r) => r.id} />);
    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("trie une colonne au clic sur l'entête", () => {
    render(<Table rows={ROWS} columns={COLS} getRowId={(r) => r.id} />);
    const header = screen.getByText("Nom");
    fireEvent.click(header);
    const rows = screen.getAllByRole("row");
    // [thead, tr1, tr2, tr3]
    const firstDataRow = within(rows[1] as HTMLElement).getByText("Alpha");
    expect(firstDataRow).toBeInTheDocument();
  });

  it("filtre avec filterText", () => {
    render(<Table rows={ROWS} columns={COLS} getRowId={(r) => r.id} filterText="char" />);
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });

  it("déclenche onRowClick", () => {
    const onRowClick = vi.fn();
    render(<Table rows={ROWS} columns={COLS} getRowId={(r) => r.id} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText("Bravo"));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ name: "Bravo" }));
  });

  it("affiche pagination quand rows > virtualThreshold", () => {
    const many: Row[] = Array.from({ length: 150 }, (_, i) => ({
      id: String(i),
      name: `Row ${i}`,
      amount: i,
    }));
    render(
      <Table
        rows={many}
        columns={COLS}
        getRowId={(r) => r.id}
        virtualThreshold={100}
        rowsPerPage={50}
      />
    );
    expect(screen.getByText(/page 1 \/ 3/i)).toBeInTheDocument();
  });
});
