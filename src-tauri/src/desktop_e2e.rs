//! Compiled only in disposable desktop test binaries. No renderer commands.
use crate::errors::Error;
use std::{
    fs,
    path::{Path, PathBuf},
};

fn validate_root(path: &Path, nonce: &str) -> Result<PathBuf, Error> {
    let root = path.canonicalize()?;
    let temp = std::env::temp_dir().canonicalize()?;
    if root.parent() != Some(temp.as_path())
        || !root.file_name().is_some_and(|name| {
            name.to_string_lossy()
                .starts_with("legalmaster-desktop-e2e-")
        })
        || uuid::Uuid::parse_str(nonce).is_err()
        || fs::read_to_string(root.join("runner-marker"))? != nonce
    {
        return Err(Error::Operation);
    }
    Ok(root)
}

pub fn root() -> Result<PathBuf, Error> {
    let path = std::env::var_os("LEGALMASTER_E2E_ROOT").ok_or(Error::Operation)?;
    let nonce = std::env::var("LEGALMASTER_E2E_NONCE").map_err(|_| Error::Operation)?;
    validate_root(Path::new(&path), &nonce)
}

// The runner writes one enum choice; paths never come from React or this file.
pub fn selection(kind: &str) -> Result<PathBuf, Error> {
    let root = root()?;
    let choice = fs::read_to_string(root.join("dialog-selection"))?;
    match (kind, choice.as_str()) {
        (_, "cancel") => Err(Error::Cancelled),
        ("attachment", "attachment") => {
            let path = root.join("fixtures/fictional.pdf");
            if path.canonicalize()?.parent() != Some(root.join("fixtures").as_path()) {
                return Err(Error::Operation);
            }
            Ok(path)
        }
        ("backup", "corrupt") => {
            let path = root.join("fixtures/corrupt.lmsbackup");
            if path.canonicalize()?.parent() != Some(root.join("fixtures").as_path()) {
                return Err(Error::Operation);
            }
            Ok(path)
        }
        ("backup", "backup") => {
            let mut backups = fs::read_dir(root.join("vault/Backups"))?
                .filter_map(Result::ok)
                .map(|entry| entry.path())
                .filter(|path| path.extension().is_some_and(|ext| ext == "lmsbackup"))
                .collect::<Vec<_>>();
            backups.sort();
            let path = backups.pop().ok_or(Error::Operation)?;
            if path.canonicalize()?.parent() != Some(root.join("vault/Backups").as_path()) {
                return Err(Error::Operation);
            }
            Ok(path)
        }
        _ => Err(Error::Operation),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn isolation_requires_a_marked_direct_temporary_child() {
        let dir = tempfile::Builder::new()
            .prefix("legalmaster-desktop-e2e-")
            .tempdir()
            .unwrap();
        let nonce = uuid::Uuid::new_v4().to_string();
        assert!(validate_root(dir.path(), &nonce).is_err());
        fs::write(dir.path().join("runner-marker"), &nonce).unwrap();
        assert_eq!(
            validate_root(dir.path(), &nonce).unwrap(),
            dir.path().canonicalize().unwrap()
        );
        assert!(validate_root(dir.path(), &uuid::Uuid::new_v4().to_string()).is_err());
        assert!(validate_root(dir.path(), "invalid").is_err());
        let nested = dir.path().join("legalmaster-desktop-e2e-nested");
        fs::create_dir(&nested).unwrap();
        fs::write(nested.join("runner-marker"), &nonce).unwrap();
        assert!(validate_root(&nested, &nonce).is_err());
    }
}
