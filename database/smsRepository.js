const { toNumber } = require('../services/discountCalculator');

async function ensureSmsSchema(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sms_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT NOT NULL UNIQUE,
      account_number TEXT,
      event_type TEXT NOT NULL,
      recipient TEXT NOT NULL,
      message TEXT NOT NULL,
      reference_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      provider_id TEXT,
      last_error TEXT,
      scheduled_at TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sms_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 1,
      reading_mode TEXT NOT NULL DEFAULT 'after_reading',
      sender_name TEXT NOT NULL DEFAULT 'SAMELCO II',
      updated_at TEXT NOT NULL
    );
    INSERT OR IGNORE INTO sms_config (id, updated_at) VALUES (1, datetime('now'));
  `);
}

async function getSmsSettings(db) {
  await ensureSmsSchema(db);
  const row = await db.getFirstAsync('SELECT * FROM sms_config WHERE id = 1');
  return {
    enabled: Boolean(row?.enabled ?? 1),
    readingMode: row?.reading_mode || 'after_reading',
    senderName: row?.sender_name || 'SAMELCO II',
  };
}

async function saveSmsSettings(db, settings = {}) {
  await ensureSmsSchema(db);
  const current = await getSmsSettings(db);
  const readingMode = ['disabled', 'after_reading', 'bulk'].includes(settings.readingMode)
    ? settings.readingMode
    : current.readingMode;
  await db.runAsync(
    `UPDATE sms_config SET enabled = ?, reading_mode = ?, sender_name = ?, updated_at = ? WHERE id = 1`,
    [settings.enabled === undefined ? (current.enabled ? 1 : 0) : settings.enabled ? 1 : 0, readingMode, settings.senderName || current.senderName, new Date().toISOString()]
  );
  return getSmsSettings(db);
}

async function queueSms(db, input = {}) {
  await ensureSmsSchema(db);
  const now = new Date().toISOString();
  const recipient = String(input.recipient || '').trim();
  const message = String(input.message || '').trim();
  if (!recipient || !message) throw new Error('A recipient and message are required.');
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO sms_outbox
      (idempotency_key, account_number, event_type, recipient, message, reference_id, status, scheduled_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [String(input.idempotencyKey), input.accountNumber || '', input.eventType || 'other', recipient, message, input.referenceId || '', input.scheduledAt || now, now, now]
  );
  return db.getFirstAsync('SELECT * FROM sms_outbox WHERE id = ? OR idempotency_key = ? LIMIT 1', [result.lastInsertRowId || -1, String(input.idempotencyKey)]);
}

async function listSmsOutbox(db, options = {}) {
  await ensureSmsSchema(db);
  const limit = Math.min(500, Math.max(1, Number(options.limit) || 100));
  if (options.status) {
    return db.getAllAsync(`SELECT * FROM sms_outbox WHERE status = ? ORDER BY created_at DESC LIMIT ?`, [options.status, limit]);
  }
  return db.getAllAsync(`SELECT * FROM sms_outbox ORDER BY created_at DESC LIMIT ?`, [limit]);
}

async function countSmsOutbox(db, status = 'pending') {
  await ensureSmsSchema(db);
  const row = await db.getFirstAsync('SELECT COUNT(*) AS count FROM sms_outbox WHERE status = ?', [status]);
  return toNumber(row?.count);
}

async function markSmsSent(db, id, providerId = '') {
  await ensureSmsSchema(db);
  const now = new Date().toISOString();
  await db.runAsync(`UPDATE sms_outbox SET status = 'sent', provider_id = ?, sent_at = ?, updated_at = ?, last_error = NULL WHERE id = ?`, [providerId, now, now, id]);
}

async function markSmsFailed(db, id, error) {
  await ensureSmsSchema(db);
  await db.runAsync(`UPDATE sms_outbox SET status = 'failed', attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ?`, [String(error || 'SMS delivery failed'), new Date().toISOString(), id]);
}

async function resetFailedSms(db, id = null) {
  await ensureSmsSchema(db);
  if (id == null) {
    await db.runAsync(`UPDATE sms_outbox SET status = 'pending', updated_at = ? WHERE status = 'failed'`, [new Date().toISOString()]);
  } else {
    await db.runAsync(`UPDATE sms_outbox SET status = 'pending', updated_at = ? WHERE id = ?`, [new Date().toISOString(), id]);
  }
}

module.exports = {
  countSmsOutbox,
  ensureSmsSchema,
  getSmsSettings,
  listSmsOutbox,
  markSmsFailed,
  markSmsSent,
  queueSms,
  resetFailedSms,
  saveSmsSettings,
};
