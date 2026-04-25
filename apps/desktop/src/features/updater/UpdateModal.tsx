/**
 * UpdateModal — modale d'installation. Affiche les notes de release (markdown
 * via react-markdown) + un bouton « Installer et relancer ». Pendant le DL,
 * progress bar Brutal en escalier (pas de gradient, pas de blur).
 */

import { Modal } from "@fakt/ui";
import type { ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useUpdater } from "./UpdaterContext.js";

interface UpdateModalProps {
  open: boolean;
  onClose: () => void;
}

export function UpdateModal({ open, onClose }: UpdateModalProps): ReactElement | null {
  const { info, progress, install } = useUpdater();
  if (!info) return null;

  const phase = progress.phase;
  const isWorking = phase === "downloading" || phase === "installing";
  const canClose = !isWorking;
  const percent = computePercent(progress.downloaded, progress.total);

  const title = `Mise à jour v${info.version}`;

  return (
    <Modal open={open} title={title} size="md" {...(canClose ? { onClose } : {})}>
      <div data-testid="update-modal" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            fontWeight: 700,
          }}
        >
          Version installée v{info.currentVersion} → nouvelle v{info.version}
        </p>

        {info.notes ? (
          <div
            data-testid="update-modal-notes"
            style={{
              maxHeight: 220,
              overflowY: "auto",
              border: "2px solid var(--ink)",
              padding: 12,
              background: "var(--surface)",
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--ink)",
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{info.notes}</ReactMarkdown>
          </div>
        ) : (
          <p style={{ margin: 0, fontStyle: "italic", color: "var(--muted)" }}>
            Pas de notes de version. Voir CHANGELOG.md sur GitHub.
          </p>
        )}

        {(phase === "downloading" || phase === "installing") && (
          <ProgressBlock phase={phase} percent={percent} />
        )}
        {phase === "error" && progress.error && <ErrorBlock message={progress.error} />}
        {phase === "done" && (
          <p
            data-testid="update-modal-done"
            style={{
              margin: 0,
              fontFamily: "var(--font-ui)",
              fontWeight: 700,
              fontSize: 13,
              color: "var(--ink)",
              textTransform: "uppercase",
            }}
          >
            Installation terminée — FAKT redémarre…
          </p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          {canClose && phase !== "error" && phase !== "done" && (
            <ModalButton variant="ghost" onClick={onClose} testId="update-modal-cancel">
              Annuler
            </ModalButton>
          )}
          {phase === "error" && (
            <ModalButton variant="ghost" onClick={onClose} testId="update-modal-close">
              Fermer
            </ModalButton>
          )}
          {(phase === "idle" || phase === "error") && (
            <ModalButton
              variant="primary"
              onClick={() => void install()}
              testId="update-modal-install"
            >
              {phase === "error" ? "Réessayer" : "Installer et relancer"}
            </ModalButton>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ProgressBlock({
  phase,
  percent,
}: {
  phase: "downloading" | "installing";
  percent: number | null;
}): ReactElement {
  const label = phase === "installing" ? "Installation…" : "Téléchargement…";
  const indeterminate = percent === null;
  return (
    <div
      data-testid="update-modal-progress"
      style={{ display: "flex", flexDirection: "column", gap: 6 }}
    >
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--ink)",
        }}
      >
        {label}
        {indeterminate ? "" : ` ${percent}%`}
      </span>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? 0}
        aria-valuetext={indeterminate ? "Préparation" : `${percent}%`}
        style={{
          height: 14,
          border: "2px solid var(--ink)",
          background: "var(--surface)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: indeterminate ? "30%" : `${percent}%`,
            background: "#FFFF00",
            borderRight: indeterminate ? "2px solid var(--ink)" : "none",
            transition: indeterminate ? "none" : "width 120ms linear",
            animation: indeterminate ? "fakt-updater-indeterminate 1.2s linear infinite" : "none",
          }}
        />
      </div>
      <style>
        {
          "@keyframes fakt-updater-indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(330%); } }"
        }
      </style>
    </div>
  );
}

function ErrorBlock({ message }: { message: string }): ReactElement {
  return (
    <div
      role="alert"
      data-testid="update-modal-error"
      style={{
        border: "2px solid var(--ink)",
        background: "#FFFF00",
        padding: 12,
        fontFamily: "var(--font-ui)",
        fontSize: 13,
        color: "var(--ink)",
        fontWeight: 700,
      }}
    >
      Erreur — {message}
    </div>
  );
}

interface ModalButtonProps {
  variant: "primary" | "ghost";
  onClick: () => void;
  testId: string;
  children: string;
}

function ModalButton({ variant, onClick, testId, children }: ModalButtonProps): ReactElement {
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      style={{
        background: isPrimary ? "var(--ink)" : "transparent",
        color: isPrimary ? "var(--accent-soft)" : "var(--ink)",
        border: "2px solid var(--ink)",
        padding: "8px 16px",
        fontFamily: "var(--font-ui)",
        fontWeight: 700,
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        cursor: "pointer",
        boxShadow: isPrimary ? "3px 3px 0 var(--ink)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function computePercent(downloaded: number, total: number | null): number | null {
  if (total === null || total === 0) return null;
  const ratio = (downloaded / total) * 100;
  if (ratio < 0) return 0;
  if (ratio > 100) return 100;
  return Math.round(ratio);
}
