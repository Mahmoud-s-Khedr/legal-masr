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

Start with fictional demo records for visual and workflow testing:

```bash
pnpm dev:seed
```

The seeded mode is deliberately opt-in and works only in a Vite development
build. Create and unlock a fresh local vault first; it seeds only an empty
vault, never adds attachments, and will leave an existing vault untouched.
The demo records use plainly fictional names and `.test` email addresses.
If a seed command fails part way through, discard that development vault and
start with a new empty one before trying again; the normal domain commands do
not expose a cross-record rollback operation to React.

Run the normal local checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
(cd src-tauri && cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test --all-features)
```

Create unsigned Linux x86-64 Debian, RPM, and AppImage packages:

```bash
pnpm build:linux
```

Both `pnpm build:linux` and `pnpm build:linux:debug` normalize the AppImage
after Tauri packages it: it uses the
host Wayland/XKB client libraries and prefers Wayland with an X11 fallback.
This avoids mixing Ubuntu's bundled compositor ABI with the graphics driver on
newer Linux distributions. The release workflow applies and verifies the same
normalization.

Expected release output is under `src-tauri/target/release/bundle/`, in the `deb/`, `rpm/`, and `appimage/` directories. Debug builds use `src-tauri/target/debug/bundle/` instead. Linux CI uses Ubuntu 24.04 because the vendored OpenSSL selected by SQLCipher requires its current glibc ABI during linking.

Linux artifacts are produced unsigned by the draft-release workflow; do not add Linux signing credentials.

## GitHub Actions builds

You do not need to produce a local package to validate a change. The **Validate**
workflow runs on pull requests, pushes to `main`, and on demand through the
Actions tab. It first executes every required frontend and Rust check. Only
after that job succeeds, Linux and Windows packaging jobs run in parallel. They
build debug Debian, Fedora RPM, and AppImage packages, and retain the non-release
artifacts for seven days as `legalmaster-solo-linux-debug-deb`,
`legalmaster-solo-linux-debug-rpm`, and
`legalmaster-solo-linux-debug-appimage`. It also builds and retains Windows
x86-64 debug artifacts for seven days as
`legalmaster-solo-windows-debug-installer` and
`legalmaster-solo-windows-debug-portable`.

To test on Fedora, download and unpack the RPM artifact from the completed
workflow run, then install the extracted package with
`sudo dnf install ./<package>.rpm`.

The validation artifacts are debug builds for test installation only. For
versioned distributable Windows, Linux, and macOS packages, use the tag/manual
**Draft release** workflow described in [RELEASING.md](RELEASING.md). It
also validates the tagged source first, then builds each platform in parallel,
and creates a draft prerelease only; it does not publish automatically.
