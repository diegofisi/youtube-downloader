# Error handling (backend)

How the frontend surfaces these errors (toasts, panels, catch boundaries) is specified by
the frontend skill. This file owns the backend side of the contract.

## Rust: `Result<T, String>` — error strings are user-facing product copy

No thiserror or custom error types: services return `Result<T, String>` and the message
reaches the frontend verbatim. These are UI strings for the user (not logs, not comments).
Until the backend has an i18n layer, backend error strings are written in the app's default
language. Treat them as product copy, not code style — code, identifiers, and comments
remain English.

```rust
fsx::write_atomic(&path, content).map_err(|e| format!("{could-not-write product copy} {…}: {}", e))?;
```

Message conventions: a stable "could not …" / "error …" opener in the product language,
the original error's `{}` detail included, and — when there is a possible user action —
a suggestion of it. The project's concrete openers and language live in project.md.

## `error_kind` pattern: failure classification without error enums

When ONE consumer needs to branch on a small closed set of failure causes, the result
struct carries an optional string code instead of a thiserror enum:

```rust
pub struct {Task}Result {
    // …
    #[serde(rename = "errorKind", skip_serializing_if = "Option::is_none")]
    pub error_kind: Option<String>, // e.g. "auth" | "retryable" | "other"
}
```

- The classification lives in ONE service function (e.g. `classify_error`) that matches
  lowercase patterns over the external tool's error output; only real error lines count
  (the rest of stderr is noise).
- Give the kinds a priority order when patterns overlap (e.g. auth beats retryable).
- Contract invariant: a classified failure comes back as a RESOLVED result carrying
  `errorKind` — NOT a rejected promise — whenever the frontend's reaction (pause a queue,
  silent re-auth, retry) depends on reading the kind.
- Rationale for strings over enums: at small scale there is one consumer branching into a
  few cases, and the error crosses to the frontend as a string anyway. Upgrade to a
  structured `{message, kind}` shape ONLY when a second consumer starts branching by kind.
- The project's real kind set, pattern tables, and per-kind reactions live in project.md.

## Rust: `.ok()` for side effects only

`.ok()` only on effects whose failure doesn't change the outcome:
`fs::create_dir_all(&dir).ok()`, `window.close().ok()`, `existing.set_focus().ok()`,
`cmd.spawn().ok()` inside a kill helper, `fs::remove_file(&tmp_path).ok()`.
With logging when it aids diagnosis: `println!` / `eprintln!` with a `[{feature}]` prefix.

If the user asked for the action explicitly, NEVER swallow the error: return the `Err` so
the frontend can show it.

Never `.unwrap()`/`.expect()` on runtime-reachable paths. Documented exceptions (e.g. a
release-mode fallback that logs and degrades instead of panicking) are listed in project.md.
