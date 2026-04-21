import type { ReactElement, ReactNode } from "react";
import { useMemo, useState } from "react";
import { tokens } from "@fakt/design-tokens";
import { classNames } from "../utils/classNames.js";

export interface TableColumn<T> {
  id: string;
  header: ReactNode;
  accessor: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | Date;
  sortable?: boolean;
  width?: number | string;
  align?: "left" | "right" | "center";
}

export interface TableProps<T> {
  rows: ReadonlyArray<T>;
  columns: ReadonlyArray<TableColumn<T>>;
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  filterText?: string;
  filterFn?: (row: T, filter: string) => boolean;
  /** Seuil à partir duquel on active la virtualisation par pagination. */
  virtualThreshold?: number;
  className?: string;
  empty?: ReactNode;
  rowsPerPage?: number;
}

type SortState = { columnId: string; dir: "asc" | "desc" } | null;

function compareSort(a: string | number | Date, b: string | number | Date): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "fr");
}

export function Table<T>({
  rows,
  columns,
  getRowId,
  onRowClick,
  filterText,
  filterFn,
  virtualThreshold = 100,
  className,
  empty,
  rowsPerPage = 100,
}: TableProps<T>): ReactElement {
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = filterText?.trim().toLowerCase() ?? "";
    if (q.length === 0) return rows;
    const fn =
      filterFn ??
      ((row: T, filter: string): boolean => {
        return columns.some((c) => {
          const v = c.accessor(row);
          return typeof v === "string" && v.toLowerCase().includes(filter);
        });
      });
    return rows.filter((r) => fn(r, q));
  }, [rows, filterText, filterFn, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.id === sort.columnId);
    if (!col?.sortValue) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = col.sortValue?.(a);
      const bv = col.sortValue?.(b);
      if (av === undefined || bv === undefined) return 0;
      const r = compareSort(av, bv);
      return sort.dir === "asc" ? r : -r;
    });
    return copy;
  }, [filtered, sort, columns]);

  const useVirtual = sorted.length > virtualThreshold;
  const visible = useVirtual
    ? sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    : sorted;

  const totalPages = useVirtual ? Math.ceil(sorted.length / rowsPerPage) : 1;

  const toggleSort = (col: TableColumn<T>): void => {
    if (col.sortable !== true || !col.sortValue) return;
    setSort((curr) => {
      if (!curr || curr.columnId !== col.id) return { columnId: col.id, dir: "asc" };
      if (curr.dir === "asc") return { columnId: col.id, dir: "desc" };
      return null;
    });
  };

  return (
    <div className={classNames(className)}>
      <table className="fakt-table" role="table">
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.columnId === c.id;
              return (
                <th
                  key={c.id}
                  data-sortable={c.sortable === true ? "true" : undefined}
                  style={{
                    width: c.width,
                    textAlign: c.align ?? "left",
                  }}
                  onClick={() => toggleSort(c)}
                  scope="col"
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {c.header}
                    {c.sortable === true && (
                      <span
                        aria-hidden
                        style={{
                          fontFamily: tokens.font.mono,
                          fontSize: 10,
                          opacity: active ? 1 : 0.35,
                        }}
                      >
                        {active ? (sort?.dir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                style={{ textAlign: "center", padding: tokens.spacing[5], color: tokens.color.muted }}
              >
                {empty ?? "Aucun résultat"}
              </td>
            </tr>
          )}
          {visible.map((row) => (
            <tr
              key={getRowId(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{ cursor: onRowClick ? "pointer" : undefined }}
            >
              {columns.map((c) => (
                <td
                  key={c.id}
                  style={{
                    textAlign: c.align ?? "left",
                    width: c.width,
                  }}
                >
                  {c.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {useVirtual && totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
            borderTop: `${tokens.stroke.base} solid ${tokens.color.ink}`,
            background: tokens.color.paper2,
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            fontWeight: Number(tokens.fontWeight.bold),
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <span>
            {sorted.length} lignes · Page {page + 1} / {totalPages}
          </span>
          <span style={{ display: "inline-flex", gap: tokens.spacing[2] }}>
            <button
              type="button"
              className="fakt-btn fakt-btn--secondary fakt-btn--sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Précédent
            </button>
            <button
              type="button"
              className="fakt-btn fakt-btn--secondary fakt-btn--sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Suivant
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
