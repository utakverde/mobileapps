-- Billing precision note/update for the mobile SQLite database.
-- SQLite does not enforce DECIMAL(scale) the way MySQL does; REAL/NUMERIC values
-- can already store 8-decimal rate and charge values. This script records the
-- expected precision policy in the database and keeps final currency columns
-- documented as 2-decimal boundaries for import/export tools.

CREATE TABLE IF NOT EXISTS app_precision_policy (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO app_precision_policy (key, value, updated_at)
VALUES
  ('rate_precision_decimals', '8', CURRENT_TIMESTAMP),
  ('line_amount_precision_decimals', '8', CURRENT_TIMESTAMP),
  ('currency_precision_decimals', '2', CURRENT_TIMESTAMP),
  ('currency_boundary_columns', 'TotalBill,balance_previous,amt_tendered,amt_change,paid_amount_total', CURRENT_TIMESTAMP);

-- Existing REAL/NUMERIC columns do not need ALTER TABLE in SQLite.
-- Keep per-rate amount values unrounded; round only in app code when writing
-- final payable currency fields.
