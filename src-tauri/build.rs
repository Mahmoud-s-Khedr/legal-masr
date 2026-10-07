fn main() {
    println!("cargo:rerun-if-env-changed=LEGAL_MASR_UPDATER_PUBLIC_KEY");
    tauri_build::build()
}
