import { tokens } from "@fakt/design-tokens";
import type {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  ReactElement,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { classNames } from "../utils/classNames.js";

export interface AutocompleteOption<T = unknown> {
  /** Clé stable unique pour chaque suggestion. */
  value: string;
  /** Texte affiché dans le dropdown. */
  label: ReactNode;
  /** Payload métier renvoyé à onSelect. */
  data?: T;
}

export interface AutocompleteProps<T = unknown> {
  /** Valeur courante (source de vérité côté parent). */
  value: string;
  onChange: (value: string) => void;
  /** Déclenché quand l'utilisateur sélectionne une suggestion (clic ou Enter). */
  onSelect: (option: AutocompleteOption<T>) => void;
  /** Liste déjà filtrée des suggestions à afficher (max ~5 recommandé). */
  suggestions: AutocompleteOption<T>[];
  /** Minimum de caractères avant d'afficher les suggestions. Défaut 2. */
  minChars?: number;
  /** Props passées au <textarea> sous-jacent. */
  inputProps?: Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "value" | "onChange" | "onKeyDown" | "onBlur" | "onFocus" | "ref"
  >;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Rendu custom d'une option (fallback : label). */
  renderOption?: (option: AutocompleteOption<T>, selected: boolean) => ReactNode;
  /** aria-label pour le champ. */
  ariaLabel?: string;
  "data-testid"?: string;
}

/**
 * Autocomplete inline, style Brutal Invoice.
 *
 * - Textarea single-line par défaut (rows=1, resize:none) + dropdown absolu
 *   en dessous avec les suggestions
 * - Navigation clavier ↑ ↓, Enter/Tab pour sélectionner, Escape pour fermer
 * - Dropdown fermé au blur (avec délai pour permettre le clic souris)
 * - Border 2px noir, ombre 3px, aucun radius
 */
export function Autocomplete<T = unknown>(props: AutocompleteProps<T>): ReactElement {
  const {
    value,
    onChange,
    onSelect,
    suggestions,
    minChars = 2,
    inputProps,
    placeholder,
    className,
    disabled,
    renderOption,
    ariaLabel,
    "data-testid": testId,
  } = props;

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  // Auto-grow : recalcule la hauteur en fonction du contenu à chaque render.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const shouldShow = useMemo(
    () => open && value.length >= minChars && suggestions.length > 0,
    [open, value, minChars, suggestions.length]
  );

  const commitSelection = useCallback(
    (idx: number): void => {
      const opt = suggestions[idx];
      if (!opt) return;
      onSelect(opt);
      setOpen(false);
    },
    [suggestions, onSelect]
  );

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>): void {
    onChange(e.target.value);
    setOpen(true);
    setHighlighted(0);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (!shouldShow) {
      if (e.key === "ArrowDown" && value.length >= minChars && suggestions.length > 0) {
        // Réouverture explicite via ↓.
        e.preventDefault();
        setOpen(true);
        setHighlighted(0);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      commitSelection(highlighted);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  function handleFocus(_e: FocusEvent<HTMLTextAreaElement>): void {
    if (value.length >= minChars && suggestions.length > 0) {
      setOpen(true);
    }
  }

  function handleBlur(_e: FocusEvent<HTMLTextAreaElement>): void {
    // Delai pour laisser passer un clic sur une suggestion.
    setTimeout(() => setOpen(false), 150);
  }

  return (
    <div
      className={classNames("fakt-autocomplete", className)}
      style={{ position: "relative", width: "100%" }}
    >
      <textarea
        {...inputProps}
        ref={textareaRef}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={shouldShow}
        aria-controls={shouldShow ? listboxId : undefined}
        aria-activedescendant={shouldShow ? `${baseId}-option-${highlighted}` : undefined}
        role="combobox"
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-testid={testId}
        className={classNames("fakt-input", inputProps?.className)}
        style={{
          ...inputProps?.style,
          width: "100%",
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.sm,
          resize: "none",
          overflow: "hidden",
        }}
      />
      {shouldShow && (
        <div
          role="listbox"
          id={listboxId}
          aria-label={ariaLabel ? `${ariaLabel} — suggestions` : "Suggestions"}
          className="fakt-autocomplete__listbox"
          style={{
            position: "absolute",
            zIndex: 40,
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            margin: 0,
            padding: 0,
            border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
            background: tokens.color.surface,
            boxShadow: tokens.shadow.sm,
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {suggestions.map((opt, idx) => {
            const isHighlighted = idx === highlighted;
            return (
              <div
                key={opt.value}
                id={`${baseId}-option-${idx}`}
                role="option"
                aria-selected={isHighlighted}
                tabIndex={-1}
                onMouseDown={(e): void => {
                  // onMouseDown pour devancer le blur du textarea.
                  e.preventDefault();
                  commitSelection(idx);
                }}
                onMouseEnter={(): void => setHighlighted(idx)}
                data-testid={`${testId ?? "autocomplete"}-option-${idx}`}
                style={{
                  padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                  fontFamily: tokens.font.ui,
                  fontSize: tokens.fontSize.sm,
                  color: isHighlighted ? tokens.color.accentSoft : tokens.color.ink,
                  background: isHighlighted ? tokens.color.ink : tokens.color.surface,
                  cursor: "pointer",
                  borderBottom:
                    idx < suggestions.length - 1 ? `1.5px solid ${tokens.color.line}` : "none",
                }}
              >
                {renderOption ? renderOption(opt, isHighlighted) : opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
