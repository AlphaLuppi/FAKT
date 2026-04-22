import type { ReactElement } from "react";
import { useState } from "react";
import { Modal } from "../src/overlays/Modal.js";
import { Button } from "../src/primitives/Button.js";

export function ModalExample(): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: 24 }}>
      <Button onClick={() => setOpen(true)}>Ouvrir modal</Button>
      <Modal
        open={open}
        title="Confirmer l'envoi"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => setOpen(false)}>Envoyer</Button>
          </>
        }
      >
        <p>
          Le devis sera envoyé à l'adresse email du client. Vous pourrez le suivre depuis la liste.
        </p>
      </Modal>
    </div>
  );
}
