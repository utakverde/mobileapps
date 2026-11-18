# SQLite Surcharge Columns

## Objective
Store an explicit surcharge flag and monetary amount and print the amount only when enabled.

## Current behavior
The invoice prints a late-payment row but the database has no authoritative surcharge fields, so the value defaults to zero.

## Desired behavior
`flag_surcharge` is a 0/1 field and `surcharge_amount` is a nonnegative monetary value. When the flag is 1, the amount increases only Total Amount After Due Date. Current bill, arrears, VAT, QR amount, and payment balance remain unchanged.

## Scope
Runtime SQLite migration, invoice persistence/reconstruction, calculator normalization, thermal output, migration artifact, and tests. Automatic collection based on the current date and surcharge editing UI are excluded.

## Architecture and ownership
The primary agent owns repository, calculator, printer, migration, database artifact, and tests. Android planner and analyzer agents supplied read-only contracts.

## Interfaces and contracts
Add `flag_surcharge INTEGER NOT NULL DEFAULT 0 CHECK(flag_surcharge IN (0,1))` and `surcharge_amount REAL NOT NULL DEFAULT 0` to reading, bill-history, and invoices. Missing/invalid/negative values resolve to disabled/zero.

## Implementation sequence
Add idempotent runtime columns, persist/reconstruct normalized values, gate printer charge by flag, update SQL arity tests, migrate a copy to schema version 3, and validate integrity and row counts.

## Risks
Old imports omit the fields and must remain compatible. Surcharge must not be double-counted or confused with the existing `penalty` property, which represents arrears.

## Testing
Cover flag enabled/disabled, missing and invalid values, unchanged current bill, SQL arity, v2-to-v3 database migration, integrity, and preserved record counts. Physical print/import testing requires a device.

## Rollback
Restore the pre-v3 database backup and revert the code. Do not destructively remove SQLite columns in place.

## Definition of done
Automated tests and integrity checks pass, schema version 3 artifact is available, and device/build limitations are reported.
