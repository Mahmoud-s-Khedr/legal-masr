# Release-candidate preparation — 2026-10-22

## Decision and scope

Selected `0.2.0` as the first public-beta candidate. It is a valid stable
semantic version for the NSIS installer, Tauri and the release script's exact
`vX.Y.Z` tag rule. Version values were aligned in `package.json`,
`src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and the root package entry
in `src-tauri/Cargo.lock`.

Prepared English and Arabic user-facing change notes and draft release notes.
They describe permanent deletion with one final confirmation, unencrypted
exports, locally saved redacted support bundles, optional tray, data-flow fixes,
the ZIP security upgrade and Windows CI harness improvements. No personal data
is included.

The launch checklist now separates completed repository work from owner-only
gates and lists those gates in required order. The parallel Linux e2e verdict
is **Linux launch-ready: NO**: automated checks pass, while physical GNOME (with
and without AppIndicator) and KDE tray checks, package install/update/removal,
and physical Windows checks remain. The checklist and release notes record this
and link to `docs/reviews/2026-10-21-linux-launch-e2e.md`, expected after merge.
The workflow review confirms it builds Windows and Linux artifacts and uses
`--draft --prerelease`, without publishing.
No tag, release or push was created.

## Workflow issue fixed

The release workflow previously wrote its Markdown body through an unquoted
shell heredoc. Backticks in the artifact names were subject to shell command
substitution. The workflow now copies `docs/release-notes/${RELEASE_TAG}.md`
into the release body, preserving its content literally and keeping the release
notes reviewed in source control.

## Conservative decisions and unresolved risks

- Use `0.2.0` rather than a pre-release suffix because the release script
  requires a simple exact `vX.Y.Z` tag and the project calls this the first
  public beta.
- Treat platform implementation and CI harness changes as repository
  completion only. Physical device acceptance, including Windows WebView2
  stability and Linux tray host behavior, remains open.
- Keep the draft explicitly unsigned per `docs/SIGNING_POLICY.md`. The owner
  must decide Authenticode signing before public distribution.
- Visual candidate approval, Egyptian privacy/legal review, privacy notice and
  terms are still required. Installation/recovery guides, support process,
  actual artifact checksum review, and cross-device/repeated restore acceptance
  remain risks.
- macOS remains out of scope. No network publishing or native desktop suites
  were run.

## Validation

| Check                                                                                                                           | Result                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/release-assets.mjs verify-version --tag v0.2.0`                                                                   | Passed.                                                                                                                                                               |
| `node scripts/release-assets.mjs stage` on temporary local fixture files                                                        | Passed: staged the five expected artifact names and verified all checksums; no release artifacts were built.                                                          |
| `pnpm verify:visual`                                                                                                            | Passed: 68 candidate captures; no approval was made.                                                                                                                  |
| `pnpm test`                                                                                                                     | Passed: 666 Vitest tests and 91 Node tests.                                                                                                                           |
| `pnpm lint`                                                                                                                     | Passed.                                                                                                                                                               |
| `pnpm typecheck`                                                                                                                | Passed.                                                                                                                                                               |
| `pnpm format:check`                                                                                                             | Passed after formatting edited Markdown.                                                                                                                              |
| `CARGO_BUILD_JOBS=2 cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`                                                  | Passed.                                                                                                                                                               |
| `CARGO_BUILD_JOBS=2 cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`              | Passed.                                                                                                                                                               |
| Isolated `CARGO_BUILD_JOBS=2 XDG_DATA_HOME=<temporary> cargo test --locked --manifest-path src-tauri/Cargo.toml --all-features` | Passed on rerun: 177 unit and 55 integration tests. The first run exposed a stale support-bundle fixture pinned to `0.1.0`; it now uses the compiled package version. |
| `git diff --check`                                                                                                              | Passed.                                                                                                                                                               |
| Native desktop suites and Tauri/package builds                                                                                  | Not run, as instructed.                                                                                                                                               |
