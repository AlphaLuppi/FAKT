//! Vérifie l'atomicité de `AppState::next_sequence` sous accès concurrent —
//! CGI art. 289 : la numérotation doit être séquentielle sans trou ni doublon.

use std::sync::Arc;
use std::thread;

use tempfile::TempDir;

use fakt_lib::commands::AppState;

#[test]
fn sequence_increments_linearly_single_thread() {
    let tmp = TempDir::new().expect("tempdir");
    let state = AppState::new(tmp.path()).expect("AppState");
    let mut seen = Vec::new();
    for _ in 0..10 {
        let seq = state
            .next_sequence("ws-1", 2026, "quote")
            .expect("next_sequence");
        seen.push(seq);
    }
    assert_eq!(seen, (1..=10).collect::<Vec<_>>());
}

#[test]
fn concurrent_threads_produce_unique_sequence() {
    let tmp = TempDir::new().expect("tempdir");
    let state = AppState::new(tmp.path()).expect("AppState");

    const THREADS: usize = 4;
    const PER_THREAD: usize = 25;

    let handles: Vec<_> = (0..THREADS)
        .map(|_| {
            let state: Arc<AppState> = Arc::clone(&state);
            thread::spawn(move || -> Vec<i64> {
                let mut out = Vec::with_capacity(PER_THREAD);
                for _ in 0..PER_THREAD {
                    out.push(
                        state
                            .next_sequence("ws-atomic", 2026, "invoice")
                            .expect("next_sequence"),
                    );
                }
                out
            })
        })
        .collect();

    let mut all = Vec::new();
    for h in handles {
        let mut v = h.join().expect("join");
        all.append(&mut v);
    }

    assert_eq!(all.len(), THREADS * PER_THREAD);
    all.sort_unstable();
    let expected: Vec<i64> = (1..=(THREADS * PER_THREAD) as i64).collect();
    assert_eq!(all, expected, "séquence doit être 1..N sans trou ni doublon");
}

#[test]
fn isolation_between_doc_types() {
    let tmp = TempDir::new().expect("tempdir");
    let state = AppState::new(tmp.path()).expect("AppState");

    let q1 = state.next_sequence("ws-iso", 2026, "quote").unwrap();
    let i1 = state.next_sequence("ws-iso", 2026, "invoice").unwrap();
    let q2 = state.next_sequence("ws-iso", 2026, "quote").unwrap();

    assert_eq!(q1, 1);
    assert_eq!(q2, 2);
    assert_eq!(i1, 1);
}
