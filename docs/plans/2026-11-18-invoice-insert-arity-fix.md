# Invoice Insert Arity Fix

## Objective
Restore Save Reading invoice persistence by correcting the `invoices` INSERT
value count that currently reports 25 values for 26 columns.

## Current behavior
`saveInvoice()` lists 26 columns but its `VALUES` clause has 25 top-level value
expressions. The parameter array already includes 27 bindings: 24 direct values,
two inputs used by the `created_at` `COALESCE`, and `updated_at`.

## Desired behavior
`invoice_json` has its own placeholder immediately before the `created_at`
expression. The INSERT has 26 value expressions and 27 bind placeholders, and
Save Reading proceeds through invoice persistence and reading update.

## Scope
Included: the SQL placeholder and a regression test. Excluded: schema changes,
billing calculations, UI, sync, permissions, and navigation.

## Architecture and ownership
`invoice_insert_fix` owns `database/invoiceRepository.js` and the focused test.
The primary agent owns integration and verification. Existing drawer changes are
unrelated and must be preserved.

## Interfaces and contracts
The existing 26-column `invoices` schema and parameter ordering remain unchanged.
No migration, API, or synchronization contract changes.

## Implementation sequence
1. Add the missing `invoice_json` SQL placeholder.
2. Add an arity/order regression test for columns, expressions, placeholders,
   parameters, and JSON position.
3. Run repository, invoice, static, and Android checks.
4. Complete independent testing, security, and release reviews.

## Risks
The current flow writes bill-history rows before the failing INSERT without a
transaction. Retrying is expected to heal those rows through current replacement
logic, but device testing should verify a previously failed record.

## Testing
Verify 26 columns, 26 top-level expressions, 27 placeholders and parameters,
JSON at parameter index 23, existing invoice tests, typecheck, lint, Android
debug build, and device saves for ordinary, large-load, and net-metering modes.

## Rollback
Revert the SQL placeholder and regression test. No data or schema rollback is
required.

## Definition of done
The SQL contract is internally consistent, automated checks pass, and device
checks run or are explicitly reported blocked.
