# Building LegalMaster Solo

LegalMaster Solo uses pnpm, Node.js 22, Rust stable, Tauri 2, SQLCipher, and vendored OpenSSL. Linux builds are local x86-64 development builds and are unsigned.

## Fedora prerequisites

Install the build toolchain and Tauri libraries:

```bash
sudo dnf install -y \
  gcc gcc-c++ make perl pkgconf-pkg-config \
  webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel \
  openssl-devel curl wget file
```

Install Rust stable with rustup, then install Node.js 22 and enable Corepack. The repository pins pnpm 10.33.0 through `packageManager` in `package.json`.

```bash
rustup toolchain install stable
rustup default stable
corepack enable
pnpm install --frozen-lockfile
```

The SQLCipher dependency vendors OpenSSL, but the standard compiler, linker, Perl, and `pkgconf` prerequisites are still required for native compilation.

## Local commands

Start the application in development mode:

```bash
pnpm tauri dev
```

Run the normal local checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
(cd src-tauri && cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test --all-features)
```

Create an unsigned Linux x86-64 Debian package:

```bash
pnpm tauri build --bundles deb
```

Expected release output is under `src-tauri/target/release/bundle/`; for the command above, the Debian package is under `src-tauri/target/release/bundle/deb/`. Debug builds use `src-tauri/target/debug/bundle/` instead.

Do not upload Linux artifacts through the public release workflow and do not add Linux signing credentials.

## GitHub Actions builds

You do not need to produce a local package to validate a change. The **Validate**
workflow runs on pull requests, pushes to `main`, and on demand through the
Actions tab. It executes every required frontend and Rust check, builds debug
Debian and Fedora RPM packages, and retains the non-release artifacts for seven
days as `legalmaster-solo-linux-debug-deb` and
`legalmaster-solo-linux-debug-rpm`.

To test on Fedora, download and unpack the RPM artifact from the completed
workflow run, then install the extracted package with
`sudo dnf install ./<package>.rpm`.

For distributable Windows and macOS packages, use the tag/manual **Draft
release** workflow described in [RELEASING.md](RELEASING.md). It creates a
draft prerelease only; it does not publish automatically.
