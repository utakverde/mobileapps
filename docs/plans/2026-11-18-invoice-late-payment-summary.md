# Invoice Late-Payment Summary

## Objective
Add the requested current-bill, arrears, amount-due, late-payment, and schedule grouping to thermal billing invoices.

## Current behavior
Both saved-source and computed invoice print paths show Bill Amount, Arrears, Total Bill, Due Date, and Disc Date using different labels. The persisted production schema has no confirmed canonical late-payment-charge column.

## Desired behavior
Both print paths show the same grouping: Sub Total, Total Current Bill, Arrears, Total Amount Due, Late Payment Charge After Due Date, Total Amount After Due Date, Due Date (Current billing), and Disco Date (Current billing). Totals must be derived from existing invoice values. An absent late charge prints as zero.

## Scope
Included: thermal invoice text generation and focused regression tests. Excluded: invoice calculation rules, database schema, payment posting, UI layout, and printer pairing.

## Architecture and ownership
The primary agent owns `services/printerService.js`, the focused printer test, and this plan. Required planner/analyzer delegates were attempted but unavailable due to the delegated-agent usage limit.

## Interfaces and contracts
No persisted schema changes. The printer accepts an optional explicit late charge from printable invoice aliases (`latePaymentCharge`, `late_payment_charge`, or `LatePaymentCharge`). Amount after due date equals amount due plus that charge.

## Implementation sequence
1. Centralize summary value calculation and row rendering.
2. Apply it to saved-source and computed print paths.
3. Add regression coverage for arrears, explicit/absent late charge, and dates.
4. Run tests, typecheck, lint, and an Android build when available.

## Risks
The source system may later expose a differently named penalty field. Defaulting to zero avoids inventing a financial charge. Long labels must wrap within the 48-character printer width.

## Testing
Assert exact labels and totals for synthetic invoices, including no arrears, arrears, zero late charge, explicit late charge, and due/disconnection dates. Physical Bluetooth printer output remains a manual device check.

## Rollback
Revert the printer helper, its two call sites, and the focused test. No data migration or persisted rollback is needed.

## Definition of done
Both print paths emit the requested grouping, automated regression checks pass, static checks pass, and any device/build limitation is reported.
