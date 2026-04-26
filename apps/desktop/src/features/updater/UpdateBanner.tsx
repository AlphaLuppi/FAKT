/**
 * UpdateBanner — bannière jaune sticky en haut de l'app, source unique de
 * vérité pour le flow de mise à jour. Style Brutal Invoice : fond #FFFF00,
 * border 2.5px noir bottom, Space Grotesk UPPERCASE 700, hover inversion
 * noir/jaune sur les CTA.
 *
 * 3 états visuels selon `progress.phase` :
 *
 *   - **idle** (update détectée, rien téléchargé) :
 *     « Mise à jour disponible — vX.Y.Z »  [Mettre à jour] [Plus tard]
 *
 *   - **downloading** (en cours) :
 *     « Téléchargement vX.Y.Z — XX% » + progress bar inline
 *
 *   - **ready** (téléchargé, install différé jusqu'au restart) :
 *     « Mise à jour installée — redémarrage requis »  [Redémarrer maintenant] [Plus tard]
 *
 *   - **error** : « Échec : <msg> »  [Réessayer] [Plus tard]
 *
 * Click sur le titre de la bannière → ouvre `UpdateModal` en mode lecture
 * seule pour consulter les notes de version (markdown rendu).
 *
 * Affichée uniquement si `available && !dismissed`.
 */

import type { CSSProperties, ReactElement } from "react";
import { useState } from "react";
import { UpdateModal } from "./UpdateModal.js";
import { useUpdater } from "./UpdaterContext.js";

export function UpdateBanner(): ReactElement | null {
  const { available, info, progress, dismissed, dismiss, download, applyAndRestart } = useUpdater();
  const [modalOpen, setModalOpen] = useState(false);

  if (!available || !info || dismissed) {
    return <UpdateModalWrapper open={modalOpen} onClose={() => setModalOpen(false)} />;
  }

  const phase = progress.phase;
  const percent = computePercent(progress.downloaded, progress.total);

  return (
    <>
      <div
        data-testid="update-banner"
        data-phase={phase}
        role="status"
        aria-live="polite"
        style={{
          background: "#FFFF00",
          borderBottom: "2.5px solid #000",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontFamily: "var(--font-ui)",
          color: "#000",
          flexShrink: 0,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          ↑
        </span>
        <BannerBody
          phase={phase}
          version={info.version}
          percent={percent}
          error={progress.error}
          onOpenNotes={() => setModalOpen(true)}
        />
        <BannerActions
          phase={phase}
          onDownload={() => void download()}
          onApply={() => void applyAndRestart()}
          onDismiss={dismiss}
        />
      </div>
      <UpdateModalWrapper open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

interface BannerBodyProps {
  phase: ReturnType<typeof useUpdater>["progress"]["phase"];
  version: string;
  percent: number | null;
  error: string | null;
  onOpenNotes: () => void;
}

function BannerBody({
  phase,
  version,
  percent,
  error,
  onOpenNotes,
}: BannerBodyProps): ReactElement {
  const baseLabelStyle: CSSProperties = {
    flex: 1,
    fontWeight: 700,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
    color: "#000",
  };

  if (phase === "downloading" || phase === "installing") {
    const label =
      phase === "installing"
        ? `Installation v${version}…`
        : percent === null
          ? `Téléchargement v${version}…`
          : `Téléchargement v${version} — ${percent}%`;
    return (
      <div
        data-testid="update-banner-progress"
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}
      >
        <strong style={{ ...baseLabelStyle, flex: undefined }}>{label}</strong>
        <ProgressBar percent={percent} />
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <strong data-testid="update-banner-ready" style={baseLabelStyle}>
        Mise à jour installée — redémarrage requis
      </strong>
    );
  }

  if (phase === "error") {
    return (
      <strong data-testid="update-banner-error" style={baseLabelStyle}>
        Échec mise à jour{error ? ` — ${error}` : ""}
      </strong>
    );
  }

  // idle / done — affichage par défaut, titre cliquable pour ouvrir les notes.
  return (
    <button
      type="button"
      data-testid="update-banner-title"
      onClick={onOpenNotes}
      style={{
        ...baseLabelStyle,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        padding: 0,
        textDecoration: "underline",
        textDecorationStyle: "solid",
        textDecorationThickness: "2px",
        textUnderlineOffset: "3px",
      }}
    >
      Mise à jour disponible — v{version}
    </button>
  );
}

interface BannerActionsProps {
  phase: ReturnType<typeof useUpdater>["progress"]["phase"];
  onDownload: () => void;
  onApply: () => void;
  onDismiss: () => void;
}

function BannerActions({
  phase,
  onDownload,
  onApply,
  onDismiss,
}: BannerActionsProps): ReactElement | null {
  if (phase === "downloading" || phase === "installing") {
    // Pas de bouton pendant DL/install : on évite les double-clics et le user
    // ne peut rien faire d'utile (le download tourne en RAM côté Rust).
    return null;
  }

  if (phase === "ready") {
    return (
      <>
        <BannerButton variant="primary" testId="update-banner-restart" onClick={onApply}>
          Redémarrer maintenant
        </BannerButton>
        <BannerButton variant="ghost" testId="update-banner-dismiss" onClick={onDismiss}>
          Plus tard
        </BannerButton>
      </>
    );
  }

  if (phase === "error") {
    return (
      <>
        <BannerButton variant="primary" testId="update-banner-retry" onClick={onDownload}>
          Réessayer
        </BannerButton>
        <BannerButton variant="ghost" testId="update-banner-dismiss" onClick={onDismiss}>
          Plus tard
        </BannerButton>
      </>
    );
  }

  // idle / done.
  return (
    <>
      <BannerButton variant="primary" testId="update-banner-install" onClick={onDownload}>
        Mettre à jour
      </BannerButton>
      <BannerButton variant="ghost" testId="update-banner-dismiss" onClick={onDismiss}>
        Plus tard
      </BannerButton>
    </>
  );
}

function ProgressBar({ percent }: { percent: number | null }): ReactElement {
  const indeterminate = percent === null;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? 0}
      aria-valuetext={indeterminate ? "Préparation" : `${percent}%`}
      data-testid="update-banner-progressbar"
      style={{
        height: 10,
        border: "2px solid #000",
        background: "#F5F5F0",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: indeterminate ? "30%" : `${percent}%`,
          background: "#000",
          transition: indeterminate ? "none" : "width 120ms linear",
          animation: indeterminate ? "fakt-banner-indeterminate 1.2s linear infinite" : "none",
        }}
      />
      <style>
        {
          "@keyframes fakt-banner-indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(330%); } }"
        }
      </style>
    </div>
  );
}

function UpdateModalWrapper({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): ReactElement | null {
  if (!open) return null;
  return <UpdateModal open={open} onClose={onClose} />;
}

interface BannerButtonProps {
  variant: "primary" | "ghost";
  testId: string;
  onClick: () => void;
  children: string;
}

function BannerButton({ variant, testId, onClick, children }: BannerButtonProps): ReactElement {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isPrimary = variant === "primary";
  const baseBg = isPrimary ? "#000" : "transparent";
  const baseColor = isPrimary ? "#FFFF00" : "#000";
  const hoverBg = isPrimary ? "#FFFF00" : "#000";
  const hoverColor = isPrimary ? "#000" : "#FFFF00";

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        background: hover ? hoverBg : baseBg,
        color: hover ? hoverColor : baseColor,
        border: "2px solid #000",
        padding: "6px 14px",
        fontFamily: "var(--font-ui)",
        fontWeight: 700,
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        cursor: "pointer",
        boxShadow: pressed ? "none" : isPrimary ? "3px 3px 0 #000" : "none",
        transform: pressed ? "translate(3px, 3px)" : "none",
        transition: "background 80ms linear, color 80ms linear",
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
