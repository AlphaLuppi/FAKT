import { Button, type ButtonProps } from "@fakt/ui";
import { type ReactElement, forwardRef } from "react";
import { isWeb } from "../utils/runtime.js";

/**
 * Wrapper autour de `<Button>` qui désactive le bouton en mode web (navigateur)
 * et affiche un tooltip natif. Utilisé pour les actions desktop-only :
 *
 *   - Signature PAdES (clé X.509 dans le keychain OS du poste signataire).
 *   - Toute action qui nécessite un accès filesystem direct ou Tauri command.
 *
 * Sur desktop (Tauri), le bouton se comporte exactement comme `<Button>`.
 *
 * Brutal Invoice : on n'a pas de Tooltip composant — on utilise l'attribut HTML
 * `title` natif (suffisant pour le MVP, pas de fioriture). Le tooltip apparaît
 * au hover sans CSS custom.
 *
 * Default `tooltip` : message FR explicite invitant à utiliser l'app desktop.
 */
export interface DesktopOnlyButtonProps extends ButtonProps {
  /** Message du tooltip natif quand on est en mode web. Défaut : message FR. */
  desktopOnlyTooltip?: string;
}

const DEFAULT_TOOLTIP =
  "Action disponible uniquement dans l'app desktop FAKT. Téléchargez-la depuis votre admin.";

export const DesktopOnlyButton = forwardRef<HTMLButtonElement, DesktopOnlyButtonProps>(
  function DesktopOnlyButton(
    { desktopOnlyTooltip, disabled, title, children, ...rest },
    ref
  ): ReactElement {
    const web = isWeb();
    const effectiveDisabled = disabled || web;
    const effectiveTitle = web ? (desktopOnlyTooltip ?? DEFAULT_TOOLTIP) : title;

    return (
      <Button
        ref={ref}
        {...rest}
        disabled={effectiveDisabled}
        {...(effectiveTitle ? { title: effectiveTitle } : {})}
        data-desktop-only={web ? "true" : undefined}
      >
        {children}
      </Button>
    );
  }
);
