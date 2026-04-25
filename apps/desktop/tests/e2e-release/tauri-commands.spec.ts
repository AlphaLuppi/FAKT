/**
 * E2E release — Tauri commands disponibles côté webview.
 *
 * On vérifie que les invoke() critiques répondent. Si un handler Rust est
 * déclaré dans `tauri::generate_handler!` mais que la signature du composant
 * front est différente (ex : nom du command renommé), invoke renvoie une
 * `not_found` error. C'est typiquement ce qui casse en release et pas en dev
 * parce que les noms sont mangled différemment.
 *
 * On teste les commands déclarées dans `apps/desktop/src-tauri/src/lib.rs` :
 *   - get_version
 *   - is_setup_completed
 *   - get_backend_mode
 */

interface InvokeResult<T = unknown> {
  ok: boolean;
  value?: T;
  error?: string;
}

async function tauriInvoke<T = unknown>(command: string): Promise<InvokeResult<T>> {
  return browser.executeAsync<InvokeResult<T>, [string]>(
    (cmd: string, done: (r: InvokeResult<T>) => void) => {
      const tauri = window as unknown as {
        __TAURI__?: { core?: { invoke: (c: string) => Promise<unknown> } };
        __TAURI_INTERNALS__?: { invoke: (c: string) => Promise<unknown> };
      };
      const invoke =
        tauri.__TAURI__?.core?.invoke ??
        ((c: string) => {
          const internals = tauri.__TAURI_INTERNALS__;
          if (!internals) return Promise.reject(new Error("Tauri internals absent"));
          return internals.invoke(c);
        });
      invoke(cmd)
        .then((value) => done({ ok: true, value: value as T }))
        .catch((e) => done({ ok: false, error: String(e) }));
    },
    command
  );
}

describe("FAKT release — Tauri commands disponibles", () => {
  it("get_version renvoie une string non vide", async () => {
    const res = await tauriInvoke<string>("get_version");
    expect(res.ok).toBe(true);
    expect(typeof res.value).toBe("string");
    expect((res.value ?? "").length).toBeGreaterThan(0);
  });

  it("is_setup_completed renvoie un booléen", async () => {
    const res = await tauriInvoke<boolean>("is_setup_completed");
    expect(res.ok).toBe(true);
    expect(typeof res.value).toBe("boolean");
  });

  it("get_backend_mode renvoie un objet avec un mode (1 ou 2)", async () => {
    const res = await tauriInvoke<{ mode: number }>("get_backend_mode");
    expect(res.ok).toBe(true);
    expect([1, 2]).toContain(res.value?.mode);
  });
});
