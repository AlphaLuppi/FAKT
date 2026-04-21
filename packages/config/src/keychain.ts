/**
 * Wrapper keychain cross-OS — TS side.
 * La vraie implémentation est côté Rust via la crate `keyring`.
 * Ce module expose un contrat d'interface pour que les consumers TS
 * puissent appeler les commands Tauri sans savoir l'implémentation sous-jacente.
 *
 * Stub W0 — les commandes Tauri seront implémentées en W1 (packages/crypto + src-tauri).
 */

export interface KeychainEntry {
  workspaceId: string;
  keyType: "rsa_private_pkcs8";
}

/**
 * Interface du keychain TS — délègue à Rust via invoke Tauri en runtime.
 * Stub retournant des erreurs explicites en dehors du contexte Tauri.
 */
export interface KeychainAdapter {
  /** Stocke une clé privée dans le keychain OS. */
  storePrivateKey(workspaceId: string, pkcs8DerBase64: string): Promise<void>;
  /** Charge une clé privée depuis le keychain OS. */
  loadPrivateKey(workspaceId: string): Promise<string>;
  /** Supprime une clé du keychain OS. */
  deleteKey(workspaceId: string): Promise<void>;
}

/** Sentinel — remplacé par TauriKeychainAdapter en runtime. */
class StubKeychainAdapter implements KeychainAdapter {
  async storePrivateKey(_workspaceId: string, _pkcs8DerBase64: string): Promise<void> {
    throw new Error(
      "KeychainAdapter non initialisé — injecte TauriKeychainAdapter au boot de l'app."
    );
  }

  async loadPrivateKey(_workspaceId: string): Promise<string> {
    throw new Error(
      "KeychainAdapter non initialisé — injecte TauriKeychainAdapter au boot de l'app."
    );
  }

  async deleteKey(_workspaceId: string): Promise<void> {
    throw new Error(
      "KeychainAdapter non initialisé — injecte TauriKeychainAdapter au boot de l'app."
    );
  }
}

let _keychain: KeychainAdapter = new StubKeychainAdapter();

export function setKeychainAdapter(adapter: KeychainAdapter): void {
  _keychain = adapter;
}

export function getKeychain(): KeychainAdapter {
  return _keychain;
}
