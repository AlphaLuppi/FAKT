import type { ReactElement } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

export interface ToasterProps {
  position?:
    | "top-left"
    | "top-right"
    | "top-center"
    | "bottom-left"
    | "bottom-right"
    | "bottom-center";
}

/** Wrapper Toaster avec classe override brutal. Pas de blur, pas de radius. */
export function Toaster({ position = "bottom-right" }: ToasterProps): ReactElement {
  return (
    <SonnerToaster
      position={position}
      className="fakt-toaster"
      toastOptions={{
        unstyled: false,
      }}
    />
  );
}

export { toast };
