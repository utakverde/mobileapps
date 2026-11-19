# Canonical Disconnection Date Column

## Objective
Add a canonical scheduled `disconnection_date` to SQLite while preserving legacy date fields.

## Current behavior
The same scheduled date is stored as `reading.Sched_DisconnectionDate`, history `DiscoDate`, and `invoices.disconnection_date`. Actual disconnection timestamps are separate.

## Desired behavior
Reading and history tables contain `disconnection_date`, backfilled from legacy values. Canonical values take read precedence while legacy fields continue to be written.

## Scope
Runtime migration, persistence/read precedence, calculator/consumer/printer fallbacks, v3-to-v4 artifact migration, and tests. Actual disconnection-event timestamps and UI editing are excluded.

## Architecture and ownership
The primary agent owns repository, calculator, consumer mapping, printer fallback, migration, artifact, and tests. Android planner and analyzer provided read-only review.

## Interfaces and contracts
Add nullable `TEXT disconnection_date` to reading, billhistory, and billhistory_disco. Preserve original text formatting. Precedence: canonical, scheduled legacy, history legacy, empty.

## Implementation sequence
Add idempotent runtime columns/backfill, dual-write on saves, update readers, add migration, produce v4 copy, and validate data/integrity.

## Risks
Legacy databases use mixed date formats. Migration copies text verbatim and never overwrites a nonempty canonical value.

## Testing
Verify legacy backfill, canonical precedence, SQL arity, saved/computed print paths, integrity, schema version, and preserved row counts. Device import/save/reopen remains a physical test.

## Rollback
Restore the v3 database and revert code. Do not destructively drop columns.

## Definition of done
Automated/static/migration checks pass, v4 artifact is available, and build/device limitations are reported.
