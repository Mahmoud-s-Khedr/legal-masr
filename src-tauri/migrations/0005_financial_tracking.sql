CREATE TABLE case_fee_agreements (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency = 'EGP'),
  agreement_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE financial_transactions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('FEE_PAYMENT','CASE_EXPENSE','REFUND','OTHER_INCOME','OTHER_EXPENSE')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency = 'EGP'),
  transaction_date TEXT NOT NULL,
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('CASH','BANK_TRANSFER','CARD','MOBILE_WALLET','OTHER')),
  description TEXT,
  receipt_document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  reversed_transaction_id TEXT UNIQUE REFERENCES financial_transactions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_financial_transactions_client_date ON financial_transactions(client_id, transaction_date DESC);
CREATE INDEX idx_financial_transactions_case_date ON financial_transactions(case_id, transaction_date DESC);
