use crate::dto::ClientDuplicateCandidate;
use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Serialize)]
pub struct ApiError {
    code: &'static str,
    message: &'static str,
    details: Option<serde_json::Value>,
    diagnostic: Option<Diagnostic>,
}

#[derive(Serialize)]
struct Diagnostic {
    kind: &'static str,
    detail: String,
}

#[derive(Error, Debug)]
pub enum Error {
    #[error("invalid password")]
    InvalidPassword,
    #[error("application is locked")]
    Locked,
    #[error("application already initialized")]
    Initialized,
    #[error("invalid recovery key")]
    InvalidRecovery,
    #[error("backup is invalid")]
    BackupInvalid,
    #[error("a populated legacy vault needs an explicit conversion")]
    LegacyDataMigrationRequired,
    #[error("validation failed")]
    Validation,
    #[error("client not found")]
    ClientNotFound,
    #[error("case not found")]
    CaseNotFound,
    #[error("client is a probable duplicate")]
    ClientProbableDuplicate(Vec<ClientDuplicateCandidate>),
    #[error("case must have at least one client")]
    CaseMustHaveClient,
    #[error("case primary client must be reassigned before this client can be detached")]
    CasePrimaryClientReassignmentRequired,
    #[error("event not found")]
    EventNotFound,
    #[error("task not found")]
    TaskNotFound,
    #[error("document source missing")]
    DocumentSourceMissing,
    #[error("document not found")]
    DocumentNotFound,
    #[error("financial transaction not found")]
    TransactionNotFound,
    #[error("operation could not be completed")]
    Operation,
    #[error("operation cancelled by user")]
    Cancelled,
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Sql(#[from] rusqlite::Error),
    #[error("{0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Zip(#[from] zip::result::ZipError),
}

impl Error {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidPassword => "INVALID_PASSWORD",
            Self::Locked => "APP_LOCKED",
            Self::Initialized => "ALREADY_INITIALIZED",
            Self::InvalidRecovery => "RECOVERY_KEY_INVALID",
            Self::BackupInvalid => "BACKUP_CORRUPTED",
            Self::LegacyDataMigrationRequired => "LEGACY_DATA_MIGRATION_REQUIRED",
            Self::Validation => "VALIDATION_FAILED",
            Self::ClientNotFound => "CLIENT_NOT_FOUND",
            Self::CaseNotFound => "CASE_NOT_FOUND",
            Self::ClientProbableDuplicate(_) => "CLIENT_PROBABLE_DUPLICATE",
            Self::CaseMustHaveClient => "CASE_MUST_HAVE_CLIENT",
            Self::CasePrimaryClientReassignmentRequired => {
                "CASE_PRIMARY_CLIENT_REASSIGNMENT_REQUIRED"
            }
            Self::EventNotFound => "EVENT_NOT_FOUND",
            Self::TaskNotFound => "TASK_NOT_FOUND",
            Self::DocumentSourceMissing => "DOCUMENT_SOURCE_MISSING",
            Self::DocumentNotFound => "DOCUMENT_NOT_FOUND",
            Self::TransactionNotFound => "TRANSACTION_NOT_FOUND",
            Self::Operation => "OPERATION_FAILED",
            Self::Cancelled => "OPERATION_CANCELLED",
            Self::Io(_) | Self::Sql(_) | Self::Json(_) | Self::Zip(_) => "OPERATION_FAILED",
        }
    }

    fn message(&self) -> &'static str {
        match self {
            Self::InvalidPassword => "كلمة المرور غير صحيحة.",
            Self::Locked => "التطبيق مقفل.",
            Self::Initialized => "تم إعداد التطبيق بالفعل.",
            Self::InvalidRecovery => "مفتاح الاسترداد غير صحيح.",
            Self::BackupInvalid => "ملف النسخة الاحتياطية غير صالح.",
            Self::LegacyDataMigrationRequired => {
                "تحتوي قاعدة البيانات القديمة على سجلات وتحتاج إلى ترحيل مخصص قبل التحديث."
            }
            Self::Validation => "تحقق من البيانات المدخلة.",
            Self::ClientNotFound => "لم يتم العثور على الموكل.",
            Self::CaseNotFound => "لم يتم العثور على القضية.",
            Self::ClientProbableDuplicate(_) => "يوجد موكل مشابه محتمل بالفعل.",
            Self::CaseMustHaveClient => "يجب أن تحتوي القضية على موكل واحد على الأقل.",
            Self::CasePrimaryClientReassignmentRequired => {
                "يجب تعيين موكل أساسي آخر قبل إزالة هذا الموكل."
            }
            Self::EventNotFound => "لم يتم العثور على الحدث.",
            Self::TaskNotFound => "لم يتم العثور على المهمة.",
            Self::DocumentSourceMissing => "تعذر العثور على الملف المصدر.",
            Self::DocumentNotFound => "لم يتم العثور على المستند.",
            Self::TransactionNotFound => "لم يتم العثور على العملية المالية.",
            Self::Operation => "تعذر إتمام العملية بأمان.",
            Self::Cancelled => "تم إلغاء العملية.",
            Self::Io(_) | Self::Sql(_) | Self::Json(_) | Self::Zip(_) => {
                "تعذر إتمام العملية بأمان."
            }
        }
    }

    // Keep diagnostics limited to implementation facts. Source error strings
    // can contain document paths or, in future, user-provided database values.
    fn diagnostic(&self) -> Diagnostic {
        match self {
            Self::Sql(rusqlite::Error::SqliteFailure(_, message)) => Diagnostic {
                kind: "SQLITE",
                detail: safe_sqlite_diagnostic(message.as_deref()),
            },
            Self::Sql(_) => Diagnostic {
                kind: "SQLITE",
                detail: "SQLite operation failed without a safe diagnostic message.".into(),
            },
            Self::Io(_) => Diagnostic {
                kind: "IO",
                detail: "Filesystem operation failed; the path is intentionally withheld.".into(),
            },
            Self::Json(_) => Diagnostic {
                kind: "JSON",
                detail: "Application metadata serialization or parsing failed.".into(),
            },
            Self::Zip(_) => Diagnostic {
                kind: "ZIP",
                detail: "Backup archive operation failed.".into(),
            },
            _ => Diagnostic {
                kind: "APPLICATION",
                detail: "The operation returned the stable error code shown above.".into(),
            },
        }
    }
}

fn detailed_diagnostics_enabled() -> bool {
    cfg!(debug_assertions)
        && matches!(
            std::env::var("VITE_DETAILED_DIAGNOSTICS").as_deref(),
            Ok("true" | "1")
        )
}

fn safe_sqlite_diagnostic(message: Option<&str>) -> String {
    let Some(message) = message else {
        return "SQLite operation failed without a database message.".into();
    };

    for prefix in ["no such column: ", "no such table: "] {
        if let Some(name) = message.strip_prefix(prefix) {
            if !name.is_empty()
                && name.chars().all(|character| {
                    character.is_ascii_alphanumeric() || matches!(character, '_' | '.')
                })
            {
                return format!("SQLite schema mismatch — {prefix}{name}");
            }
        }
    }

    if message.contains("file is not a database") {
        return "The local database could not be opened as a SQLite database.".into();
    }
    if message.contains("database disk image is malformed") {
        return "The local SQLite database appears malformed.".into();
    }
    if message.contains("database is locked") {
        return "The local SQLite database is locked by another operation.".into();
    }

    "SQLite operation failed; the database message was withheld for privacy.".into()
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let details = match self {
            Self::ClientProbableDuplicate(candidates) => serde_json::to_value(candidates).ok(),
            _ => None,
        };
        let diagnostic = detailed_diagnostics_enabled().then(|| self.diagnostic());
        if let Some(diagnostic) = &diagnostic {
            tracing::error!(
                error_code = self.code(),
                diagnostic_kind = diagnostic.kind,
                diagnostic_detail = %diagnostic.detail,
                "command failed"
            );
        }
        ApiError {
            code: self.code(),
            message: self.message(),
            details,
            diagnostic,
        }
        .serialize(serializer)
    }
}

#[cfg(test)]
mod tests {
    use super::safe_sqlite_diagnostic;

    #[test]
    fn exposes_a_safe_missing_column_diagnostic() {
        assert_eq!(
            safe_sqlite_diagnostic(Some("no such column: autostart_enabled")),
            "SQLite schema mismatch — no such column: autostart_enabled"
        );
    }

    #[test]
    fn withholds_unrecognised_sqlite_messages() {
        assert_eq!(
            safe_sqlite_diagnostic(Some("constraint failed: clients.phone = 01000000000")),
            "SQLite operation failed; the database message was withheld for privacy."
        );
    }
}
