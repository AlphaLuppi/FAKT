/**
 * UpdateBanner — bannière jaune sticky en haut de l'app quand une mise à jour
 * est disponible. Style Brutal Invoice : fond #FFFF00, border 2.5px noir
 * bottom, Space Grotesk UPPERCASE 700, hover inversion noir/jaune sur les CTA.
 *
 * Affichée seulement si `available && !dismissed && !showModal`. Le modal
 * d'installation prend le relais une fois ouvert.
 */

import type { ReactElement } from "react";
import { useState } from "react";
import { UpdateModal } from "./UpdateModal.js";
import { useUpdater } from "./UpdaterContext.js";

export function UpdateBanner(): ReactElement | null {
  const { available, info, dismissed, dismiss } = useUpdater();
  const [modalOpen, setModalOpen] = useState(false);

  if (!available || !info || dismissed)
    return <UpdateModalWrapper open={modalOpen} onClose={() => setModalOpen(false)} />;

  return (
    <>
      <div
        data-testid="update-banner"
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
        <strong
          style={{
            flex: 1,
            fontWeight: 700,
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: "0.02em",
          }}
        >
          Mise à jour disponible — v{info.version}
        </strong>
        <BannerButton
          variant="primary"
          testId="update-banner-install"
          onClick={() => setModalOpen(true)}
        >
          Installer maintenant
        </BannerButton>
        <BannerButton variant="ghost" testId="update-banner-dismiss" onClick={dismiss}>
          Plus tard
        </BannerButton>
      </div>
      <UpdateModalWrapper open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
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
