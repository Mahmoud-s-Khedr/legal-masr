use crate::errors::Error;
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    XChaCha20Poly1305, XNonce,
};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fs, path::Path};

#[derive(Serialize, Deserialize)]
pub struct Envelope {
    pub nonce: String,
    pub ciphertext: String,
}

#[derive(Serialize, Deserialize)]
pub struct SecurityFile {
    pub version: u8,
    pub salt: String,
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
    pub password_envelope: Envelope,
    pub recovery_envelope: Envelope,
}

pub fn random_32() -> [u8; 32] {
    let mut v = [0; 32];
    OsRng.fill_bytes(&mut v);
    v
}

pub fn derive_password(
    password: &str,
    salt: &[u8],
    memory_kib: u32,
    iterations: u32,
    parallelism: u32,
) -> Result<[u8; 32], Error> {
    let mut output = [0; 32];
    let params = Params::new(memory_kib, iterations, parallelism, Some(32))
        .map_err(|_| Error::InvalidPassword)?;
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(password.as_bytes(), salt, &mut output)
        .map_err(|_| Error::InvalidPassword)?;
    Ok(output)
}

pub fn wrap(key: &[u8; 32], value: &[u8; 32]) -> Result<Envelope, Error> {
    let nonce = random_32();
    let cipher = XChaCha20Poly1305::new_from_slice(key).map_err(|_| Error::InvalidPassword)?;
    let ciphertext = cipher
        .encrypt(XNonce::from_slice(&nonce[..24]), value.as_ref())
        .map_err(|_| Error::InvalidPassword)?;
    Ok(Envelope {
        nonce: STANDARD.encode(&nonce[..24]),
        ciphertext: STANDARD.encode(ciphertext),
    })
}

pub fn unwrap(key: &[u8; 32], envelope: &Envelope) -> Result<[u8; 32], Error> {
    let nonce = STANDARD
        .decode(&envelope.nonce)
        .map_err(|_| Error::InvalidPassword)?;
    let ciphertext = STANDARD
        .decode(&envelope.ciphertext)
        .map_err(|_| Error::InvalidPassword)?;
    let cipher = XChaCha20Poly1305::new_from_slice(key).map_err(|_| Error::InvalidPassword)?;
    let bytes = cipher
        .decrypt(XNonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| Error::InvalidPassword)?;
    bytes.try_into().map_err(|_| Error::InvalidPassword)
}

pub fn recovery_key_material(key: &str) -> [u8; 32] {
    Sha256::digest(key.replace('-', "").as_bytes()).into()
}

pub fn read_security(path: &Path) -> Result<SecurityFile, Error> {
    Ok(serde_json::from_slice(&fs::read(path)?)?)
}

pub fn backup_key(master: &[u8; 32]) -> [u8; 32] {
    Sha256::digest([master.as_slice(), b"LegalMasterSolo/backup/v1"].concat()).into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_envelope_round_trip_rejects_wrong_password() {
        let salt = random_32();
        let master = random_32();
        let correct = derive_password("a secure local password", &salt, 19_456, 2, 1).unwrap();
        let incorrect = derive_password("a different local password", &salt, 19_456, 2, 1).unwrap();
        let envelope = wrap(&correct, &master).unwrap();
        assert_eq!(unwrap(&correct, &envelope).unwrap(), master);
        assert!(unwrap(&incorrect, &envelope).is_err());
    }

    #[test]
    fn recovery_key_material_is_stable_and_distinct() {
        assert_eq!(
            recovery_key_material("abcd-ef01"),
            recovery_key_material("abcdef01")
        );
        assert_ne!(
            recovery_key_material("abcdef01"),
            recovery_key_material("abcdef02")
        );
    }

    #[test]
    fn backup_key_is_separate_from_the_database_master_key() {
        let master = random_32();
        assert_ne!(backup_key(&master), master);
    }
}
