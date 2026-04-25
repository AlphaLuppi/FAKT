import { computeLineTotal } from "@fakt/core";
import { tokens } from "@fakt/design-tokens";
import { formatEur, fr, quantityFromMilli } from "@fakt/shared";
import type { DocumentUnit, Service, UUID } from "@fakt/shared";
import { Autocomplete, type AutocompleteOption, Button, Input, Select } from "@fakt/ui";
import type { ReactElement } from "react";
import { useMemo } from "react";

export interface EditableItem {
  id: UUID;
  position: number;
  description: string;
  /** Quantité en millièmes (1500 = 1.5). */
  quantity: number;
  unitPriceCents: number;
  unit: DocumentUnit;
  lineTotalCents: number;
  serviceId: UUID | null;
}

export interface ItemsEditorProps {
  value: EditableItem[];
  onChange: (items: EditableItem[]) => void;
  /** Bibliothèque de prestations proposée via un Select optionnel. */
  prestations?: ReadonlyArray<Service> | undefined;
  /** Désactive l'édition (mode Detail). */
  readOnly?: boolean | undefined;
  /** Injecté par les tests pour UUID déterministe. */
  makeId?: (() => UUID) | undefined;
}

const UNITS: ReadonlyArray<{ value: DocumentUnit; label: string }> = [
  { value: "forfait", label: fr.services.units.forfait },
  { value: "jour", label: fr.services.units.jour },
  { value: "heure", label: fr.services.units.heure },
  { value: "unité", label: fr.services.units.unite },
  { value: "mois", label: fr.services.units.mois },
  { value: "semaine", label: fr.services.units.semaine },
];

function defaultMakeId(): UUID {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback déterministe pour environnements de tests legacy.
  return `item-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function ItemsEditor(props: ItemsEditorProps): ReactElement {
  const { value, onChange, prestations, readOnly, makeId } = props;
  const newId = makeId ?? defaultMakeId;

  const unitOptions = useMemo(() => UNITS.map((u) => ({ value: u.value, label: u.label })), []);

  function updateItem(idx: number, patch: Partial<EditableItem>): void {
    const next = value.map((item, i) => {
      if (i !== idx) return item;
      const merged = { ...item, ...patch } satisfies EditableItem;
      merged.lineTotalCents = computeLineTotal(merged.quantity, merged.unitPriceCents);
      return merged;
    });
    onChange(next);
  }

  function addItem(): void {
    const item: EditableItem = {
      id: newId(),
      position: value.length,
      description: "",
      quantity: 1000,
      unitPriceCents: 0,
      unit: "jour",
      lineTotalCents: 0,
      serviceId: null,
    };
    onChange([...value, item]);
  }

  function removeItem(idx: number): void {
    const next = value.filter((_, i) => i !== idx).map((item, i) => ({ ...item, position: i }));
    onChange(next);
  }

  function move(idx: number, direction: -1 | 1): void {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= value.length) return;
    const next = [...value];
    const tmp = next[idx];
    const other = next[newIdx];
    if (!tmp || !other) return;
    next[idx] = other;
    next[newIdx] = tmp;
    onChange(next.map((item, i) => ({ ...item, position: i })));
  }

  function applyPrestation(idx: number, prestationId: string): void {
    const p = prestations?.find((pp) => pp.id === prestationId);
    if (!p) return;
    updateItem(idx, {
      description: p.description ?? p.name,
      unit: p.unit,
      unitPriceCents: p.unitPriceCents,
      serviceId: p.id,
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing[3],
      }}
    >
      <div
        style={{
          border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
          background: tokens.color.surface,
          boxShadow: tokens.shadow.sm,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.8fr 0.6fr 0.8fr 0.9fr 0.9fr 0.6fr",
            gap: tokens.spacing[3],
            padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
            background: tokens.color.paper2,
            borderBottom: `${tokens.stroke.base} solid ${tokens.color.ink}`,
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.xs,
            fontWeight: Number(tokens.fontWeight.bold),
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          <div>{fr.quotes.form.description}</div>
          <div>{fr.quotes.form.quantity}</div>
          <div>{fr.quotes.form.unit}</div>
          <div>{fr.quotes.form.unitPrice}</div>
          <div style={{ textAlign: "right" }}>{fr.quotes.form.lineTotal}</div>
          <div />
        </div>

        {value.length === 0 && (
          <div
            style={{
              padding: tokens.spacing[5],
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              color: tokens.color.muted,
              textAlign: "center",
            }}
            data-testid="items-empty"
          >
            {fr.quotes.form.noItems}
          </div>
        )}

        {value.map((item, idx) => (
          <ItemRow
            key={item.id}
            item={item}
            idx={idx}
            unitOptions={unitOptions}
            prestations={prestations}
            readOnly={readOnly === true}
            lastIdx={value.length - 1}
            onApplyPrestation={(pid) => applyPrestation(idx, pid)}
            onUpdate={(patch) => updateItem(idx, patch)}
            onRemove={() => removeItem(idx)}
            onMove={(dir) => move(idx, dir)}
          />
        ))}
      </div>

      {readOnly !== true && (
        <div style={{ display: "flex", gap: tokens.spacing[2] }}>
          <Button variant="secondary" size="sm" onClick={addItem} data-testid="items-add">
            {fr.quotes.form.addItem}
          </Button>
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.xs,
              color: tokens.color.muted,
              alignSelf: "center",
            }}
          >
            {fr.quotes.form.vatNote}
          </span>
        </div>
      )}
    </div>
  );
}

interface ItemRowProps {
  item: EditableItem;
  idx: number;
  lastIdx: number;
  unitOptions: ReadonlyArray<{ value: string; label: string }>;
  prestations?: ReadonlyArray<Service> | undefined;
  readOnly: boolean;
  onApplyPrestation: (id: string) => void;
  onUpdate: (patch: Partial<EditableItem>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

/** Max suggestions affichées dans l'autocomplete description. */
const DESC_SUGGESTIONS_MAX = 5;

function filterPrestations(
  query: string,
  prestations: ReadonlyArray<Service>
): AutocompleteOption<Service>[] {
  const q = query.trim().toLowerCase();
  const matches: AutocompleteOption<Service>[] = [];
  for (const p of prestations) {
    const haystack = `${p.name} ${p.description ?? ""}`.toLowerCase();
    // Query vide → retourne les N premières prestations (focus sans saisie).
    if (q.length === 0 || haystack.includes(q)) {
      matches.push({
        value: p.id,
        label: `${p.name} · ${formatEur(p.unitPriceCents)} / ${p.unit}`,
        data: p,
      });
      if (matches.length >= DESC_SUGGESTIONS_MAX) break;
    }
  }
  return matches;
}

function ItemRow(props: ItemRowProps): ReactElement {
  const {
    item,
    idx,
    lastIdx,
    unitOptions,
    prestations,
    readOnly,
    onApplyPrestation,
    onUpdate,
    onRemove,
    onMove,
  } = props;

  const qtyDisplay = quantityFromMilli(item.quantity).toString();
  const unitPriceDisplay = (item.unitPriceCents / 100).toString();

  const suggestions = useMemo(
    () =>
      prestations && prestations.length > 0 ? filterPrestations(item.description, prestations) : [],
    [item.description, prestations]
  );

  return (
    <div
      data-testid={`item-row-${idx}`}
      style={{
        display: "grid",
        gridTemplateColumns: "1.8fr 0.6fr 0.8fr 0.9fr 0.9fr 0.6fr",
        gap: tokens.spacing[3],
        padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
        borderBottom: idx < lastIdx ? `1.5px solid ${tokens.color.line}` : "none",
        alignItems: "flex-start",
      }}
    >
      <div>
        <Autocomplete<Service>
          value={item.description}
          onChange={(v) => onUpdate({ description: v })}
          onSelect={(opt) => onApplyPrestation(opt.value)}
          suggestions={prestations && prestations.length > 0 ? suggestions : []}
          minChars={0}
          ariaLabel={fr.quotes.form.description}
          disabled={readOnly}
          data-testid={`item-description-${idx}`}
          inputProps={{
            rows: 1,
            className: "fakt-input",
            style: {
              padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
              border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
              background: tokens.color.surface,
              color: tokens.color.ink,
              lineHeight: 1.3,
              minHeight: 36,
            },
          }}
        />
      </div>

      <Input
        type="number"
        aria-label={fr.quotes.form.quantity}
        value={qtyDisplay}
        min={0}
        step="0.001"
        onChange={(e) => {
          const n = Number.parseFloat(e.target.value);
          const milli = Number.isFinite(n) ? Math.round(n * 1000) : 0;
          onUpdate({ quantity: Math.max(0, milli) });
        }}
        disabled={readOnly}
        data-testid={`item-quantity-${idx}`}
      />

      <Select
        aria-label={fr.quotes.form.unit}
        options={unitOptions}
        value={item.unit}
        onChange={(e) => onUpdate({ unit: e.target.value as DocumentUnit })}
        disabled={readOnly}
        data-testid={`item-unit-${idx}`}
      />

      <Input
        type="number"
        aria-label={fr.quotes.form.unitPrice}
        value={unitPriceDisplay}
        min={0}
        step="0.01"
        onChange={(e) => {
          const n = Number.parseFloat(e.target.value);
          const cents = Number.isFinite(n) ? Math.round(n * 100) : 0;
          onUpdate({ unitPriceCents: Math.max(0, cents) });
        }}
        disabled={readOnly}
        data-testid={`item-unit-price-${idx}`}
      />

      <div
        data-testid={`item-total-${idx}`}
        style={{
          fontFamily: tokens.font.mono,
          fontSize: tokens.fontSize.sm,
          fontVariantNumeric: "tabular-nums",
          fontWeight: Number(tokens.fontWeight.bold),
          textAlign: "right",
          alignSelf: "center",
          color: tokens.color.ink,
        }}
      >
        {formatEur(item.lineTotalCents)}
      </div>

      <div
        style={{
          display: "flex",
          gap: tokens.spacing[1],
          alignSelf: "center",
          justifyContent: "flex-end",
        }}
      >
        {readOnly !== true && (
          <>
            <button
              type="button"
              className="fakt-btn fakt-btn--ghost fakt-btn--sm"
              aria-label={fr.quotes.form.moveUp}
              disabled={idx === 0}
              onClick={() => onMove(-1)}
              data-testid={`item-move-up-${idx}`}
            >
              ↑
            </button>
            <button
              type="button"
              className="fakt-btn fakt-btn--ghost fakt-btn--sm"
              aria-label={fr.quotes.form.moveDown}
              disabled={idx === lastIdx}
              onClick={() => onMove(1)}
              data-testid={`item-move-down-${idx}`}
            >
              ↓
            </button>
            <button
              type="button"
              className="fakt-btn fakt-btn--ghost fakt-btn--sm"
              aria-label={fr.quotes.form.removeItem}
              onClick={onRemove}
              data-testid={`item-remove-${idx}`}
            >
              ×
            </button>
          </>
        )}
      </div>
    </div>
  );
}
