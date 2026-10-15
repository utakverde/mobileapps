export type UtilityPlatformArea =
  | 'Identity and Access'
  | 'Master Data'
  | 'Operations'
  | 'Analytics'
  | 'Transfer and Sync'
  | 'Audit and Control'
  | 'Accounting Integration';

export interface UtilityPlatformSection {
  title: string;
  description: string;
  items: string[];
}

export interface UtilityModuleGroup {
  title: string;
  area: UtilityPlatformArea;
  modules: string[];
}

export const UTILITY_ACCOUNT_FAMILIES = [
  'Regular Consumer',
  'BAPA Main',
  'BAPA Individual',
  'Net Metering',
  'Lifeline',
  'Senior',
  'Disconnection',
  'Reconnection',
] as const;

export const UTILITY_PLATFORM_SECTIONS: UtilityPlatformSection[] = [
  {
    title: 'Identity and Access',
    description: 'Login mode selection, roles, and session scope across desktop, web, and mobile.',
    items: ['Login and mode selection', 'Role-based access', 'Session-scoped account family'],
  },
  {
    title: 'Master Data',
    description: 'Shared consumers, rates, routes, books, service grid, and user management.',
    items: ['Consumers', 'Accounts', 'Rates', 'Areas / Books', 'Routes', 'Service Grid', 'Users'],
  },
  {
    title: 'Operations',
    description: 'Reading, billing, collections, disconnection, reconnection, and complaints.',
    items: ['Billing', 'Collections', 'Scheduling', 'Disconnection', 'Reconnection', 'Complaints'],
  },
  {
    title: 'Analytics',
    description: 'Sales, aging, unpaid, lifeline, senior, financial analysis, and variance views.',
    items: ['Sales', 'Aging', 'Unpaid', 'Lifeline', 'Senior', 'Financial Analysis', 'Variance'],
  },
  {
    title: 'Transfer and Sync',
    description: 'Offline-first upload/download, duplicate prevention, and conflict handling.',
    items: ['Upload', 'Download', 'Offline Queue', 'Duplicate Prevention', 'Conflict Resolution'],
  },
  {
    title: 'Audit and Control',
    description: 'Preview, approval, rollback, audit trail, and reconciliation.',
    items: ['Preview SQL', 'Rollback SQL', 'Audit History', 'Reconciliation', 'Transaction IDs'],
  },
  {
    title: 'Accounting Integration',
    description: 'Exports and postings for receivables, collections, adjustments, and fees.',
    items: ['Receivables', 'Collections', 'Adjustments', 'Fees', 'Journal Mapping', 'Reversal Handling'],
  },
];

export const UTILITY_MODULE_GROUPS: UtilityModuleGroup[] = [
  {
    title: 'Member Services',
    area: 'Master Data',
    modules: ['Members Profile', 'Billing Master', 'Query Members', 'Sequencing', 'Route Monitoring'],
  },
  {
    title: 'Billing Section',
    area: 'Operations',
    modules: [
      'Manual Posting',
      'Posting by Area',
      'BAPA Manual Posting',
      'BAPA Batch Printing',
      'BAPA Payment Posting',
      'Manual Posting Net Metering',
      'Flat Rate',
      'Other Charges',
      'Billing Register',
      'Billing Logs',
      'System Logs',
    ],
  },
  {
    title: 'Finance Section',
    area: 'Master Data',
    modules: ['ERC and Tax Rates', 'Reading Schedule', 'Service Grid', 'Bill Adjustment', 'Late Billing', 'Reports'],
  },
  {
    title: 'Teller Section',
    area: 'Operations',
    modules: [
      'Payment Collection',
      'Collection Report',
      'Collection by OR',
      'Collection by Bill',
      'Membership Bill Payments',
      'Non Power Bill Payments',
    ],
  },
  {
    title: 'Data Transfer',
    area: 'Transfer and Sync',
    modules: [
      'Book List',
      'Upload to Device',
      'Download from Device',
      'Offline Download',
      'Upload Disconnection',
      'Download Paid Disco',
      'Offline Download Disco',
      'System Update',
      'XZ Device Reading',
    ],
  },
  {
    title: 'Reports Center',
    area: 'Analytics',
    modules: [
      'Billing Register',
      'Sales by Area',
      'Over All Sales',
      'Sales by Ratecode',
      'Sales by Fees',
      'Sales by Rate',
      "Collection Sales",
      'Aging Analysis',
      'Aging Summary',
      'Unpaid Bills',
      "Consumer Data",
      "Collected UC's",
      'VAT',
      'Collection',
      'MCC and Others',
      'Lifeline',
      'Batch Receipt',
    ],
  },
  {
    title: 'Configuration',
    area: 'Audit and Control',
    modules: ['Configuration', 'System Users', 'Area/Book', 'Service Grid', 'Database Update'],
  },
  {
    title: 'Cross-Cutting',
    area: 'Audit and Control',
    modules: ['Financial Analysis', 'System Map', 'Complaints', 'Mobile Sync', 'Accounting Export'],
  },
];

export const PHASE_1_TARGETS = [
  'Module inventory',
  'Desktop screen inventory',
  'Account-family inventory',
  'Shared data contract map',
  'Field alias map',
  'Write-safety rules',
  'Sync contract rules',
  'Duplicate-prevention rules',
  'Preview / rollback requirements',
  'Reconciliation checkpoints',
  'Accounting export candidates',
] as const;

