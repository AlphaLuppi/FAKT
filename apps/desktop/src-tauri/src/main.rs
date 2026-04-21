// Supprime la fenêtre console Windows en release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    fakt_lib::run()
}
