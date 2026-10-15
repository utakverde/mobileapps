export type UtilityDomain =
  | 'identity_access'
  | 'master_data'
  | 'operations'
  | 'analytics'
  | 'transfer_sync'
  | 'audit_control'
  | 'accounting';

export type WriteSafetyLevel = 'read_only' | 'preview_required' | 'rollback_required' | 'approval_required';

export interface UtilityFieldAliases {
  canonical: string;
  aliases: string[];
  note: string;
}

export interface UtilityEntityContract {
  key: string;
  label: string;
  domain: UtilityDomain;
  sourceSystems: readonly string[];
  writeSafety: WriteSafetyLevel;
  syncEnabled: boolean;
  duplicateKey: string;
  reconciliationKey: string;
  description: string;
}

export interface UtilityRuleContract {
  key: string;
  title: string;
  description: string;
}

export const UTILITY_SHARED_ENTITIES: UtilityEntityContract[] = [
  {
    key: 'consumer',
    label: 'Consumer / Member',
    domain: 'master_data',
    sourceSystems: ['desktop', 'web', 'android'],
    writeSafety: 'preview_required',
    syncEnabled: true,
    duplicateKey: 'accountNumber + billMonth',
    reconciliationKey: 'accountNumber + billMonth + reading sequence',
    description: 'Canonical consumer record used by billing, collections, reports, and complaints.',
  },
  {
    key: 'bill',
    label: 'Bill / Invoice',
    domain: 'operations',
    sourceSystems: ['desktop', 'web', 'android'],
    writeSafety: 'rollback_required',
    syncEnabled: true,
    duplicateKey: 'transactionId + accountNumber + billMonth',
    reconciliationKey: 'billNumber + OR number + billMonth',
    description: 'Posted bill snapshot that must preserve the original calculation and adjustment trail.',
  },
  {
    key: 'collection',
    label: 'Collection / Payment',
    domain: 'operations',
    sourceSystems: ['desktop', 'web', 'android'],
    writeSafety: 'rollback_required',
    syncEnabled: true,
    duplicateKey: 'orNumber + collectorId',
    reconciliationKey: 'orNumber + accountNumber + paymentDate',
    description: 'Receipt-backed payment posting for teller and field collection flows.',
  },
  {
    key: 'schedule',
    label: 'Reading / Billing Schedule',
    domain: 'master_data',
    sourceSystems: ['desktop', 'web'],
    writeSafety: 'preview_required',
    syncEnabled: true,
    duplicateKey: 'areaCode + bookNumber + billMonth',
    reconciliationKey: 'areaCode + bookNumber + dueDate',
    description: 'Shared read, due, and disconnection schedule for routing and posting.',
  },
  {
    key: 'complaint',
    label: 'Complaint / Incident',
    domain: 'operations',
    sourceSystems: ['desktop', 'web', 'android'],
    writeSafety: 'preview_required',
    syncEnabled: true,
    duplicateKey: 'accountNumber + reportType + createdAt',
    reconciliationKey: 'accountNumber + status + updatedAt',
    description: 'Field-reported issue that can travel across devices and later link to billing or service actions.',
  },
  {
    key: 'sync_record',
    label: 'Sync Record',
    domain: 'transfer_sync',
    sourceSystems: ['desktop', 'web', 'android'],
    writeSafety: 'read_only',
    syncEnabled: true,
    duplicateKey: 'transactionId + sourceSystem + action',
    reconciliationKey: 'transactionId + syncBatchId',
    description: 'Idempotent transfer envelope used to prevent duplicate uploads and downloads.',
  },
  {
    key: 'audit_entry',
    label: 'Audit Entry',
    domain: 'audit_control',
    sourceSystems: ['desktop', 'web', 'android'],
    writeSafety: 'read_only',
    syncEnabled: true,
    duplicateKey: 'transactionId + eventType + createdAt',
    reconciliationKey: 'transactionId + module + createdAt',
    description: 'Immutable trace for before and after states, previews, approvals, and rollbacks.',
  },
  {
    key: 'accounting_export',
    label: 'Accounting Export',
    domain: 'accounting',
    sourceSystems: ['web', 'desktop'],
    writeSafety: 'approval_required',
    syncEnabled: false,
    duplicateKey: 'exportBatchId + transactionId',
    reconciliationKey: 'exportBatchId + glAccount + sourceRef',
    description: 'Outbound financial posting package for accounting system integration.',
  },
];

export const UTILITY_FIELD_ALIAS_MAP: UtilityFieldAliases[] = [
  {
    canonical: 'accountNumber',
    aliases: ['AccountNumber', 'accountnumber', 'acct_no', 'account_no'],
    note: 'Primary account identifier used to link billing, collections, and sync records.',
  },
  {
    canonical: 'billMonth',
    aliases: ['BillMonth', 'billmonth', 'billing_month', 'month'],
    note: 'Billing cycle key that must stay stable across desktop, web, and mobile.',
  },
  {
    canonical: 'consumerName',
    aliases: ['Name', 'Fullname', 'ConsumerName', 'customer_name'],
    note: 'Display name for reports and receipts.',
  },
  {
    canonical: 'sequenceNumber',
    aliases: ['Sequence', 'sequence', 'seq_no'],
    note: 'Route ordering field used by reading, posting, and reconciliation screens.',
  },
  {
    canonical: 'presentReading',
    aliases: ['present_reading', 'PresentReadingKWH', 'Reading_KWH', 'reading_kwh'],
    note: 'Current reading field that drives the bill computation and anomaly checks.',
  },
  {
    canonical: 'previousReading',
    aliases: ['Reading_KWH_Prev', 'PreviousReadingKWH', 'previous_reading'],
    note: 'Baseline reading used to compute consumption deltas.',
  },
  {
    canonical: 'kwhUsed',
    aliases: ['computed_kwh', 'KilowattHour', 'KilowattUsed', 'kwh_used'],
    note: 'Calculated usage value that must preserve the existing billing formula.',
  },
  {
    canonical: 'totalDue',
    aliases: ['total_bill', 'TotalBill', 'amount_due', 'balance_previous'],
    note: 'Posted amount used for payable, adjustment, and aging logic.',
  },
  {
    canonical: 'paymentDate',
    aliases: ['date_paid', 'paymentDate', 'payment_date', 'Read_Time'],
    note: 'Transaction timestamp for collections and payment reports.',
  },
  {
    canonical: 'transactionId',
    aliases: ['tx_id', 'transaction_id', 'sync_id', 'id'],
    note: 'Stable idempotency key for local, API, and sync operations.',
  },
];

export const UTILITY_WRITE_SAFETY_RULES: UtilityRuleContract[] = [
  {
    key: 'preview-before-write',
    title: 'Preview before write',
    description: 'Every bill, collection, adjustment, schedule, and complaint write needs a preview of affected rows before commit.',
  },
  {
    key: 'rollback-for-postings',
    title: 'Rollback for postings',
    description: 'Any financial posting must emit a rollback SQL script or reversible transaction descriptor before execution.',
  },
  {
    key: 'preserve-billing-formula',
    title: 'Preserve billing formula',
    description: 'Consumption, rate, lifeline, tax, and penalty math must match the desktop bill creation logic exactly.',
  },
  {
    key: 'idempotent-sync',
    title: 'Idempotent sync',
    description: 'Upload and download operations must reject duplicates using a stable transaction identifier and source reference.',
  },
  {
    key: 'audit-first',
    title: 'Audit first',
    description: 'Before any destructive or correcting action, capture the original state, operator, timestamp, and reason.',
  },
];

export const UTILITY_SYNC_RULES: UtilityRuleContract[] = [
  {
    key: 'source-owned-keys',
    title: 'Source-owned keys',
    description: 'Desktop, web, and Android each own their local staging keys but must map to the shared transactionId on sync.',
  },
  {
    key: 'duplicate-prevention',
    title: 'Duplicate prevention',
    description: 'Sync records should be deduplicated by account, bill month, receipt number, and export batch before write.',
  },
  {
    key: 'partial-failure',
    title: 'Partial failure handling',
    description: 'A failed module upload must not block unrelated modules; queue the failure and keep the last good state.',
  },
  {
    key: 'reconciliation-ledger',
    title: 'Reconciliation ledger',
    description: 'Every sync batch should generate counts and totals that can be matched against the receiving ledger.',
  },
];

export const UTILITY_RECONCILIATION_CHECKPOINTS: UtilityRuleContract[] = [
  {
    key: 'bill-vs-collection',
    title: 'Bill versus collection',
    description: 'Confirm posted bills, collections, penalties, and change against teller and billing registers.',
  },
  {
    key: 'read-vs-billed-kwh',
    title: 'Read versus billed kWh',
    description: 'Compare captured readings, computed kWh, and lifeline adjustments for anomaly detection.',
  },
  {
    key: 'aging-vs-unpaid',
    title: 'Aging versus unpaid',
    description: 'Tie aging buckets back to unpaid bills and collection timing to catch reporting drift.',
  },
  {
    key: 'accounting-export',
    title: 'Accounting export',
    description: 'Validate GL-ready totals before handing batches to an accounting system.',
  },
];

export const UTILITY_ACCOUNTING_EXPORT_CANDIDATES: UtilityRuleContract[] = [
  {
    key: 'billing-receivable',
    title: 'Billing receivable',
    description: 'Unpaid bills, billed amounts, and balance forward postings for AR integration.',
  },
  {
    key: 'cash-collection',
    title: 'Cash collection',
    description: 'OR-based collections, deposits, and payment method summaries.',
  },
  {
    key: 'adjustments',
    title: 'Adjustments',
    description: 'Bill corrections, write-offs, rebates, and manual billing fixes.',
  },
  {
    key: 'fees-and-taxes',
    title: 'Fees and taxes',
    description: 'ERC, VAT, late fee, and other statutory or special charges.',
  },
  {
    key: 'lifeline-discount',
    title: 'Lifeline discount',
    description: 'Discount calculations and subsidy postings that must remain auditable.',
  },
];

