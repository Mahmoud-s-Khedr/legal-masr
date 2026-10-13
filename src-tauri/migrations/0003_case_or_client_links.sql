-- Link consistency between cases, clients, tasks, expenses and powers of attorney.
--
-- * A task or expense is linked to a case OR to a client, never both: the client is
--   already known through the case, and the client's own view derives case work.
-- * A client has at most one active power of attorney (a POA may have many clients).
-- * A case's power of attorney is derived from its client, never picked per case.
--
-- Only triggers, a view and data updates: `attachments.expense_id` cascades from
-- `expenses`, so a table rebuild inside this transaction would delete documents.
-- Triggers guard new writes only; they do not reject rows that already exist.

-- 1. Case XOR client on tasks and expenses.
UPDATE tasks SET client_id = NULL WHERE case_id IS NOT NULL AND client_id IS NOT NULL;
UPDATE expenses SET client_id = NULL WHERE case_id IS NOT NULL AND client_id IS NOT NULL;

CREATE TRIGGER tasks_case_or_client_insert
BEFORE INSERT ON tasks
WHEN NEW.case_id IS NOT NULL AND NEW.client_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'LINK_CASE_OR_CLIENT');
END;

CREATE TRIGGER tasks_case_or_client_update
BEFORE UPDATE OF case_id, client_id ON tasks
WHEN NEW.case_id IS NOT NULL AND NEW.client_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'LINK_CASE_OR_CLIENT');
END;

CREATE TRIGGER expenses_case_or_client_insert
BEFORE INSERT ON expenses
WHEN NEW.case_id IS NOT NULL AND NEW.client_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'LINK_CASE_OR_CLIENT');
END;

CREATE TRIGGER expenses_case_or_client_update
BEFORE UPDATE OF case_id, client_id ON expenses
WHEN NEW.case_id IS NOT NULL AND NEW.client_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'LINK_CASE_OR_CLIENT');
END;

-- 2. The per-case POA pointer is retired. The column and its composite foreign key stay
--    (SQLite cannot drop a column that an index and a foreign key use) but are always NULL.
UPDATE case_clients SET power_of_attorney_id = NULL WHERE power_of_attorney_id IS NOT NULL;

CREATE TRIGGER case_clients_poa_pointer_retired_insert
BEFORE INSERT ON case_clients
WHEN NEW.power_of_attorney_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'CASE_POA_POINTER_RETIRED');
END;

CREATE TRIGGER case_clients_poa_pointer_retired_update
BEFORE UPDATE OF power_of_attorney_id ON case_clients
WHEN NEW.power_of_attorney_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'CASE_POA_POINTER_RETIRED');
END;

-- 3. A client's current POA: the active one, else the newest archived one. The case page
--    and the POA's case list both read this view, so they cannot disagree.
CREATE VIEW client_current_poa AS
SELECT client_id, power_of_attorney_id
FROM (
  SELECT pc.client_id,
         pc.power_of_attorney_id,
         ROW_NUMBER() OVER (
           PARTITION BY pc.client_id
           ORDER BY (p.archived_at IS NULL) DESC, p.created_at DESC, p.id
         ) AS ordinal
  FROM power_of_attorney_clients pc
  JOIN powers_of_attorney p ON p.id = pc.power_of_attorney_id
)
WHERE ordinal = 1;

-- 4. One active POA per client. Partial indexes cannot span tables, so triggers guard
--    both ways a second active POA could appear: linking, and restoring an archived POA.
CREATE TRIGGER poa_clients_one_active_poa
BEFORE INSERT ON power_of_attorney_clients
WHEN (SELECT archived_at FROM powers_of_attorney WHERE id = NEW.power_of_attorney_id) IS NULL
 AND EXISTS (
   SELECT 1
   FROM power_of_attorney_clients other
   JOIN powers_of_attorney p ON p.id = other.power_of_attorney_id
   WHERE other.client_id = NEW.client_id
     AND other.power_of_attorney_id <> NEW.power_of_attorney_id
     AND p.archived_at IS NULL
 )
BEGIN
  SELECT RAISE(ABORT, 'CLIENT_ALREADY_HAS_POWER_OF_ATTORNEY');
END;

CREATE TRIGGER poa_restore_one_active_poa
BEFORE UPDATE OF archived_at ON powers_of_attorney
WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL
 AND EXISTS (
   SELECT 1
   FROM power_of_attorney_clients mine
   JOIN power_of_attorney_clients other
     ON other.client_id = mine.client_id AND other.power_of_attorney_id <> mine.power_of_attorney_id
   JOIN powers_of_attorney p ON p.id = other.power_of_attorney_id
   WHERE mine.power_of_attorney_id = NEW.id AND p.archived_at IS NULL
 )
BEGIN
  SELECT RAISE(ABORT, 'CLIENT_ALREADY_HAS_POWER_OF_ATTORNEY');
END;
