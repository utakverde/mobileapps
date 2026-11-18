# New Invoice Charge Format

## Objective
Replace the thermal invoice's old flattened charge lists with the supplied new statutory hierarchy.

## Current behavior
Saved and computed invoices use separate flattened Generation/Transmission, Distribution, Others, VAT, and Universal sections.

## Desired behavior
Both paths share ordered Generation and Transmission, Distribution Revenue, Other Charges, Government Charges, and Government-Mandated Pass Through sections with the supplied subheadings and rows.

## Scope
Thermal invoice presentation and regression tests only. Billing calculations, persisted schema, Bluetooth transport, navigation, and permissions are excluded.

## Architecture and ownership
The primary agent owns `services/printerService.js`, tests, and integration. Android planner and analyzer agents provided read-only mapping review.

## Interfaces and contracts
No schema/API change. Known rows use existing rate and amount fields. Unsupported statutory rows remain visible with zero values rather than receiving invented mappings.

## Implementation sequence
Create a shared data-driven hierarchy, render nested groups within 48 columns, replace both old print branches, then run invoice/static/build checks.

## Risks
Long labels may truncate on 48-column printers. Optional source fields may be absent. The formatter must not change or duplicate financial amounts.

## Testing
Verify exact heading order and representative mappings in both saved and computed outputs, missing fields produce zero, calculations remain unchanged, and physical printer verification is reported separately.

## Rollback
Revert the shared hierarchy helpers and restore the two former section compositions. No data rollback is required.

## Definition of done
Both invoice paths use the new hierarchy; regression, calculation, type, lint, and diff checks pass; build/device limitations are reported.
