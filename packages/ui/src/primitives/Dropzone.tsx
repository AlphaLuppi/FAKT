import { tokens } from "@fakt/design-tokens";
import type { CSSProperties, DragEvent, KeyboardEvent, ReactElement, ReactNode } from "react";
import { useCallback, useId, useRef, useState } from "react";
import { classNames } from "../utils/classNames.js";

export interface DropzoneProps {
  /** Callback invoqué avec la liste de fichiers déposés ou sélectionnés. */
  onFiles: (files: File[]) => void | Promise<void>;
  /** Liste d'extensions acceptées (ex: [".txt", ".md", ".pdf"]). Pas de validation stricte — simple indicateur. */
  accept?: ReadonlyArray<string>;
  /** Désactive la zone (drag + clic). */
  disabled?: boolean;
  /** Contenu interne (textarea, autres champs). Reste visible au repos. */
  children?: ReactNode;
  /** Label affiché pendant un drag-over. Défaut : "DÉPOSE TON FICHIER ICI". */
  label?: string;
  /** Autoriser la sélection multi-fichiers via le dialog. */
  multiple?: boolean;
  /** ID optionnel pour testid / aria. */
  "data-testid"?: string;
}

/**
 * Dropzone Brutal Invoice — accepte drag-drop + clic.
 * - Repos : border 2px dashed noir, children visibles.
 * - Dragover : border 2.5px solid noir + fond jaune + overlay label UPPERCASE.
 * - Clic ouvre un <input type="file"> caché (même accept).
 *
 * Pattern d'intégration : wrapper autour d'une section (textarea + actions).
 */
export function Dropzone({
  onFiles,
  accept,
  disabled = false,
  children,
  label = "DÉPOSE TON FICHIER ICI",
  multiple = true,
  "data-testid": testId,
}: DropzoneProps): ReactElement {
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const inputId = useId();

  const acceptAttr = accept && accept.length > 0 ? accept.join(",") : undefined;

  const openFileDialog = useCallback((): void => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current += 1;
      setIsOver(true);
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      // Forcer le curseur copy.
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsOver(false);
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setIsOver(false);
      const dt = e.dataTransfer;
      if (!dt) return;
      const files = Array.from(dt.files ?? []);
      if (files.length === 0) return;
      void onFiles(files);
    },
    [disabled, onFiles]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFileDialog();
      }
    },
    [disabled, openFileDialog]
  );

  const wrapperStyle: CSSProperties = {
    position: "relative",
    // Repos : zéro chrome pour ne pas redoubler la bordure de la section parent.
    // Dragover : on matérialise la zone avec une bordure forte + fond jaune.
    border: isOver ? `${tokens.stroke.bold} solid ${tokens.color.ink}` : "none",
    background: "transparent",
    padding: 0,
    transition: "background 120ms linear",
    cursor: disabled ? "not-allowed" : "auto",
    opacity: disabled ? 0.6 : 1,
  };

  const overlayStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: tokens.color.accentSoft,
    fontFamily: tokens.font.ui,
    fontWeight: Number(tokens.fontWeight.bold),
    fontSize: tokens.fontSize.md,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: tokens.color.ink,
    pointerEvents: "none",
    zIndex: 2,
  };

  return (
    <div
      className={classNames("fakt-dropzone", isOver && "fakt-dropzone--over")}
      style={wrapperStyle}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={label}
      data-testid={testId}
      data-over={isOver ? "true" : "false"}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(e) => {
        // Ne pas ouvrir le dialog si l'utilisateur cible un input/bouton child.
        const target = e.target as HTMLElement;
        const isInteractive =
          target.closest("input, textarea, button, select, a, [contenteditable='true']") !== null;
        if (!isInteractive) openFileDialog();
      }}
      onKeyDown={handleKeyDown}
    >
      {children}
      {isOver && <div style={overlayStyle}>{label}</div>}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple={multiple}
        accept={acceptAttr}
        style={{ display: "none" }}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length === 0) return;
          void onFiles(files);
          // Reset pour autoriser re-sélection du même fichier.
          e.target.value = "";
        }}
      />
    </div>
  );
}
