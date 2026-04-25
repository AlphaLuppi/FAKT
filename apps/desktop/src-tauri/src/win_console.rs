//! Helpers `CREATE_NO_WINDOW` pour les subprocess Windows.
//!
//! Sans ce flag, chaque `Command::spawn` lancé depuis Tauri (subsystem WINDOWS)
//! fait flasher une fenêtre `cmd.exe` noire ~100 ms : cassant l'illusion d'app
//! native, P0 sur la release grand public. Tom a vu un terminal popper à
//! chaque action UI (extraction IA, draft email .eml, génération PDF Typst).
//!
//! Deux helpers : un pour `std::process::Command` (sync), un pour
//! `tokio::process::Command` (async). Sur les autres OS ce sont des no-op.

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Applique `CREATE_NO_WINDOW` sur un `tokio::process::Command`.
#[inline]
pub fn silence_tokio(cmd: &mut tokio::process::Command) {
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = cmd;
    }
}

/// Applique `CREATE_NO_WINDOW` sur un `std::process::Command`.
#[inline]
pub fn silence_std(cmd: &mut std::process::Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = cmd;
    }
}
