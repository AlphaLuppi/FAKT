/**
 * UpdateModal — modale de consultation des notes de release.
 *
 * Mode lecture seule : affiche le titre, le delta de version et les notes
 * (markdown rendu via react-markdown). Les actions de mise à jour
 * (download / restart) sont déclenchées depuis `UpdateBanner` — la modale
 * n'a qu'un bouton « Fermer ».
 *
 * Ouverte par un click sur le titre de la bannière quand l'update est
 * détectée (états idle / done). Pendant un download ou en phase 'ready',
 * la bannière elle-même montre le statut, donc la modale n'est plus
 * indispensable au flow et reste informative.
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
  const { info } = useUpdater();
  if (!info) return null;

  const title = `Mise à jour v${info.version}`;

  return (
    <Modal open={open} title={title} size="md" onClose={onClose}>
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
              maxHeight: 320,
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

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <ModalButton onClick={onClose} testId="update-modal-close">
            Fermer
          </ModalButton>
        </div>
      </div>
    </Modal>
  );
}

interface ModalButtonProps {
  onClick: () => void;
  testId: string;
  children: string;
}

function ModalButton({ onClick, testId, children }: ModalButtonProps): ReactElement {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      style={{
        background: "var(--ink)",
        color: "var(--accent-soft)",
        border: "2px solid var(--ink)",
        padding: "8px 16px",
        fontFamily: "var(--font-ui)",
        fontWeight: 700,
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        cursor: "pointer",
        boxShadow: "3px 3px 0 var(--ink)",
      }}
    >
      {children}
    </button>
  );
}
