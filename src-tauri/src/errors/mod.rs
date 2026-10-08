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
    #[error("vault operation interrupted; recovery required")]
    VaultInterrupted,
    #[error("vault database missing")]
    VaultMissing,
    #[error("vault artifacts incomplete")]
    VaultIncomplete,
    #[error("vault database corrupt")]
    VaultCorrupt,
    #[error("vault requires a newer application")]
    VaultNewerSchema,
    #[error("validation failed")]
    Validation,
    #[error("client not found")]
    ClientNotFound,
    #[error("case not found")]
    CaseNotFound,
    #[error("power of attorney not found")]
    PowerOfAttorneyNotFound,
    #[error("power of attorney client is relied on by a case")]
    PowerOfAttorneyClientInUse,
    #[error("hearing not found")]
    HearingNotFound,
    #[error("client is a probable duplicate")]
    ClientProbableDuplicate(Vec<ClientDuplicateCandidate>),
    #[error("client number is already used")]
    ClientNumberTaken,
    #[error("case number is already used")]
    CaseNumberTaken,
    #[error("power of attorney number is already used")]
    PowerOfAttorneyNumberTaken,
    #[error("case must have at least one client")]
    CaseMustHaveClient,
    #[error("case primary client must be reassigned before this client can be detached")]
    CasePrimaryClientReassignmentRequired,
    #[error("case client has payments")]
    CaseClientHasPayments,
    #[error("client is archived")]
    ClientArchived,
    #[error("case is archived")]
    CaseArchived,
    #[error("backup belongs to another installation")]
    BackupFromOtherVault,
    #[error("backup cannot be opened on another installation")]
    BackupNotPortable,
    #[error("backup password or recovery key is wrong")]
    BackupSecretInvalid,
    #[error("no backup yet")]
    BackupMissing,
    #[error("task not found")]
    TaskNotFound,
    #[error("attachment source missing")]
    AttachmentSourceMissing,
    #[error("attachment not found")]
    AttachmentNotFound,
    #[error("payment not found")]
    PaymentNotFound,
    #[error("expense not found")]
    ExpenseNotFound,
    #[error("operation could not be completed")]
    Operation,
    #[error("operation cancelled by user")]
    Cancelled,
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Sql(rusqlite::Error),
    #[error("{0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Zip(#[from] zip::result::ZipError),
}

/// A UNIQUE rule a lawyer can run into by reusing a number. Only these are
/// reported as their own error; any other database failure stays opaque.
fn violated_unique_column(error: &rusqlite::Error) -> Option<&str> {
    match error {
        rusqlite::Error::SqliteFailure(failure, Some(message))
            if failure.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE =>
        {
            message.strip_prefix("UNIQUE constraint failed: ")
        }
        _ => None,
    }
}

impl From<rusqlite::Error> for Error {
    fn from(error: rusqlite::Error) -> Self {
        match violated_unique_column(&error) {
            Some("clients.internal_number") => Self::ClientNumberTaken,
            Some("cases.internal_number") => Self::CaseNumberTaken,
            Some("powers_of_attorney.internal_sequence") => Self::PowerOfAttorneyNumberTaken,
            _ => Self::Sql(error),
        }
    }
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
            Self::VaultInterrupted => "VAULT_INTERRUPTED",
            Self::VaultMissing => "VAULT_MISSING",
            Self::VaultIncomplete => "VAULT_INCOMPLETE",
            Self::VaultCorrupt => "VAULT_CORRUPT",
            Self::VaultNewerSchema => "VAULT_NEWER_SCHEMA",
            Self::Validation => "VALIDATION_FAILED",
            Self::ClientNotFound => "CLIENT_NOT_FOUND",
            Self::CaseNotFound => "CASE_NOT_FOUND",
            Self::PowerOfAttorneyNotFound => "POWER_OF_ATTORNEY_NOT_FOUND",
            Self::PowerOfAttorneyClientInUse => "POWER_OF_ATTORNEY_CLIENT_IN_USE",
            Self::HearingNotFound => "HEARING_NOT_FOUND",
            Self::ClientProbableDuplicate(_) => "CLIENT_PROBABLE_DUPLICATE",
            Self::ClientNumberTaken => "CLIENT_NUMBER_TAKEN",
            Self::CaseNumberTaken => "CASE_NUMBER_TAKEN",
            Self::PowerOfAttorneyNumberTaken => "POWER_OF_ATTORNEY_NUMBER_TAKEN",
            Self::CaseMustHaveClient => "CASE_MUST_HAVE_CLIENT",
            Self::CasePrimaryClientReassignmentRequired => {
                "CASE_PRIMARY_CLIENT_REASSIGNMENT_REQUIRED"
            }
            Self::CaseClientHasPayments => "CASE_CLIENT_HAS_PAYMENTS",
            Self::ClientArchived => "CLIENT_ARCHIVED",
            Self::CaseArchived => "CASE_ARCHIVED",
            Self::BackupFromOtherVault => "BACKUP_FROM_OTHER_VAULT",
            Self::BackupNotPortable => "BACKUP_NOT_PORTABLE",
            Self::BackupSecretInvalid => "BACKUP_SECRET_INVALID",
            Self::BackupMissing => "BACKUP_MISSING",
            Self::TaskNotFound => "TASK_NOT_FOUND",
            Self::AttachmentSourceMissing => "ATTACHMENT_SOURCE_MISSING",
            Self::AttachmentNotFound => "ATTACHMENT_NOT_FOUND",
            Self::PaymentNotFound => "PAYMENT_NOT_FOUND",
            Self::ExpenseNotFound => "EXPENSE_NOT_FOUND",
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
            Self::VaultInterrupted => "عملية مساحة العمل غير مكتملة وتحتاج إلى الاسترداد.",
            Self::VaultMissing => "قاعدة بيانات مساحة العمل غير موجودة.",
            Self::VaultIncomplete => "ملفات مساحة العمل غير مكتملة.",
            Self::VaultCorrupt => "تعذر قراءة قاعدة بيانات مساحة العمل بأمان.",
            Self::VaultNewerSchema => "تحتاج مساحة العمل إلى إصدار أحدث من التطبيق.",
            Self::Validation => "تحقق من البيانات المدخلة.",
            Self::ClientNotFound => "لم يتم العثور على الموكل.",
            Self::CaseNotFound => "لم يتم العثور على القضية.",
            Self::PowerOfAttorneyNotFound => "لم يتم العثور على التوكيل.",
            Self::PowerOfAttorneyClientInUse => {
                "لا يمكن إزالة موكل يعتمد عليه التوكيل في إحدى القضايا."
            }
            Self::HearingNotFound => "لم يتم العثور على الجلسة.",
            Self::ClientProbableDuplicate(_) => "يوجد موكل مشابه محتمل بالفعل.",
            Self::ClientNumberTaken => "رقم الموكل مستخدم بالفعل.",
            Self::CaseNumberTaken => "رقم القضية مستخدم بالفعل.",
            Self::PowerOfAttorneyNumberTaken => "الرقم الداخلي للتوكيل مستخدم بالفعل.",
            Self::CaseMustHaveClient => "يجب أن تحتوي القضية على موكل واحد على الأقل.",
            Self::CasePrimaryClientReassignmentRequired => {
                "يجب تعيين موكل أساسي آخر قبل إزالة هذا الموكل."
            }
            Self::CaseClientHasPayments => "لا يمكن إزالة موكل له دفعات مرتبطة بالقضية.",
            Self::ClientArchived => "لا يمكن إضافة موكل مؤرشف.",
            Self::CaseArchived => "القضية مؤرشفة؛ استعدها أولًا لتعديلها.",
            Self::BackupFromOtherVault => "هذه النسخة من تثبيت آخر لليجال مصر.",
            Self::BackupNotPortable => {
                "هذه النسخة من إصدار سابق ولا تُستعاد إلا على الجهاز الذي أُنشئت عليه."
            }
            Self::BackupSecretInvalid => "كلمة المرور أو مفتاح الاسترداد لا يفتح هذه النسخة.",
            Self::BackupMissing => "لا توجد نسخة احتياطية بعد.",
            Self::TaskNotFound => "لم يتم العثور على المهمة.",
            Self::AttachmentSourceMissing => "تعذر العثور على الملف المصدر للمرفق.",
            Self::AttachmentNotFound => "لم يتم العثور على المرفق.",
            Self::PaymentNotFound => "لم يتم العثور على الدفعة.",
            Self::ExpenseNotFound => "لم يتم العثور على المصروف.",
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
