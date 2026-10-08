-- Judicial years (for example "89 قضائية") are small numbers that identify a
-- court year, not a Gregorian calendar year. They cannot share `official_year`,
-- which is constrained to 1800-9999. Existing rows keep their Gregorian year
-- untouched and receive no judicial year.
ALTER TABLE cases ADD COLUMN judicial_year INTEGER
  CHECK (judicial_year IS NULL OR judicial_year BETWEEN 1 AND 9999);
