use crate::dto::ClientDuplicateCandidate;
use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Serialize)]
pub struct ApiError {
    code: &'static str,
    message: &'static str,
    details: Option<serde_json::Value>,
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
            Self::Validation => "VALIDATION_FAILED",
            Self::ClientNotFound => "CLIENT_NOT_FOUND",
            Self::CaseNotFound => "CASE_NOT_FOUND",
            Self::ClientProbableDuplicate(_) => "CLIENT_PROBABLE_DUPLICATE",
            Self::CaseMustHaveClient => "CASE_MUST_HAVE_CLIENT",
            Self::CasePrimaryClientReassignmentRequired => {
                "CASE_PRIMARY_CLIENT_REASSIGNMENT_REQUIRED"
            }
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
            Self::Validation => "تحقق من البيانات المدخلة.",
            Self::ClientNotFound => "لم يتم العثور على الموكل.",
            Self::CaseNotFound => "لم يتم العثور على القضية.",
            Self::ClientProbableDuplicate(_) => "يوجد موكل مشابه محتمل بالفعل.",
            Self::CaseMustHaveClient => "يجب أن تحتوي القضية على موكل واحد على الأقل.",
            Self::CasePrimaryClientReassignmentRequired => {
                "يجب تعيين موكل أساسي آخر قبل إزالة هذا الموكل."
            }
            Self::Io(_) | Self::Sql(_) | Self::Json(_) | Self::Zip(_) => {
                "تعذر إتمام العملية بأمان."
            }
        }
    }
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
        ApiError {
            code: self.code(),
            message: self.message(),
            details,
        }
        .serialize(serializer)
    }
}
