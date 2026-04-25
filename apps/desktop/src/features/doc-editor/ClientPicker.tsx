import { tokens } from "@fakt/design-tokens";
import { fr } from "@fakt/shared";
import type { Client, UUID } from "@fakt/shared";
import { Button, Input } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";

export interface ClientPickerProps {
  value: UUID | null;
  onChange: (clientId: UUID | null, client: Client | null) => void;
  clients: ReadonlyArray<Client>;
  /** Invoqué par le bouton "Nouveau client rapide". Stub H1 → Track G. */
  onQuickCreate?: (() => void) | undefined;
  invalid?: boolean | undefined;
  disabled?: boolean | undefined;
}

export function ClientPicker(props: ClientPickerProps): ReactElement {
  const { value, onChange, clients, onQuickCreate, invalid, disabled } = props;
  const [search, setSearch] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) return clients;
    return clients.filter((c) => {
      const hay = `${c.name} ${c.email ?? ""} ${c.contactName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [search, clients]);

  const selected = useMemo(() => clients.find((c) => c.id === value) ?? null, [clients, value]);

  useEffect(() => {
    if (disabled === true) setOpen(false);
  }, [disabled]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing[2] }}>
      <div
        data-testid="client-picker"
        style={{
          border: `${tokens.stroke.base} solid ${invalid === true ? tokens.color.ink : tokens.color.ink}`,
          background: invalid === true ? tokens.color.dangerBg : tokens.color.surface,
          padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
          display: "flex",
          alignItems: "center",
          gap: tokens.spacing[3],
          minHeight: 52,
          boxShadow: tokens.shadow.sm,
        }}
      >
        {selected ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontFamily: tokens.font.ui,
                fontWeight: Number(tokens.fontWeight.bold),
                fontSize: tokens.fontSize.sm,
                color: tokens.color.ink,
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
              }}
            >
              {selected.name}
            </span>
            {selected.email && (
              <span
                style={{
                  fontFamily: tokens.font.ui,
                  fontSize: tokens.fontSize.xs,
                  color: tokens.color.muted,
                }}
              >
                {selected.email}
              </span>
            )}
          </div>
        ) : (
          <span
            style={{
              flex: 1,
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              color: tokens.color.muted,
            }}
          >
            {fr.quotes.form.clientPlaceholder}
          </span>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          data-testid="client-picker-toggle"
        >
          {selected ? fr.quotes.actions.edit : fr.quotes.form.clientPlaceholder}
        </Button>
        {onQuickCreate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onQuickCreate}
            disabled={disabled}
            data-testid="client-picker-quick-new"
          >
            {fr.quotes.form.clientQuickNew}
          </Button>
        )}
      </div>

      {open && (
        <div
          style={{
            border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
            background: tokens.color.surface,
            boxShadow: tokens.shadow.sm,
            padding: tokens.spacing[3],
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[3],
          }}
        >
          <Input
            type="search"
            aria-label={fr.quotes.form.clientPlaceholder}
            placeholder={fr.quotes.form.clientPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="client-picker-search"
          />
          <div
            role="listbox"
            aria-label={fr.quotes.form.clientPlaceholder}
            style={{
              maxHeight: 240,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  fontFamily: tokens.font.ui,
                  fontSize: tokens.fontSize.sm,
                  color: tokens.color.muted,
                  padding: tokens.spacing[3],
                }}
              >
                {fr.quotes.form.emptyClientList}
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={value === c.id}
                  onClick={() => {
                    onChange(c.id, c);
                    setOpen(false);
                    setSearch("");
                  }}
                  data-testid={`client-option-${c.id}`}
                  style={{
                    textAlign: "left",
                    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                    background: value === c.id ? tokens.color.ink : "transparent",
                    color: value === c.id ? tokens.color.accentSoft : tokens.color.ink,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: tokens.font.ui,
                    fontSize: tokens.fontSize.sm,
                    fontWeight: Number(tokens.fontWeight.bold),
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <span
                    style={{
                      textTransform: "uppercase",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {c.name}
                  </span>
                  {c.email && (
                    <span
                      style={{
                        fontSize: tokens.fontSize.xs,
                        fontWeight: Number(tokens.fontWeight.reg),
                        color: value === c.id ? tokens.color.accentSoft : tokens.color.muted,
                      }}
                    >
                      {c.email}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
