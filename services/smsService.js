const { Linking } = require('react-native');
const { apiJson, isApiConfigured } = require('../src/lib/api');
const { queueSms, listSmsOutbox, markSmsFailed, markSmsSent } = require('../database/smsRepository');

function normalizePhoneNumber(value) {
  const raw = String(value || '').replace(/[\s()-]/g, '');
  if (/^09\d{9}$/.test(raw)) return `+63${raw.slice(1)}`;
  if (/^9\d{9}$/.test(raw)) return `+63${raw}`;
  if (/^63\d{10}$/.test(raw)) return `+${raw}`;
  if (/^\+639\d{9}$/.test(raw)) return raw;
  return '';
}

function firstPhone(record = {}) {
  return normalizePhoneNumber(record.MobileNumber || record.mobileNumber || record.Mobile || record.ContactNumber || record.Phone || record.TelNo);
}

function money(value) {
  return Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function readingMessage(invoice, reading, sender = 'SAMELCO II') {
  const p = invoice?.printableInvoice || invoice || {};
  return `${sender}: Account ${p.accountNumber || reading.AccountNumber}, reading for ${p.billMonth || reading.BillMonth} is ${p.presentReading ?? reading.Reading_KWH}. Consumption: ${p.computedKwh ?? invoice?.computedKwh ?? 0} kWh. Est. bill: PHP ${money(p.totalBill ?? invoice?.totalBill)}. Due: ${p.dueDate || reading.Sched_DueDate || 'N/A'}.`;
}

function paymentMessage(payment, sender = 'SAMELCO II') {
  return `${sender}: Payment received for account ${payment.accountNumber}. OR No. ${payment.orNumber || payment.ornumber}. Amount paid: PHP ${money(payment.amountPaid ?? payment.TotalBill)}. Date: ${payment.paymentDate || payment.date_paid || 'N/A'}. Thank you.`;
}

function disconnectionMessage(consumer, sender = 'SAMELCO II') {
  return `${sender} NOTICE: Account ${consumer.accountNumber} has an unpaid balance of PHP ${money(consumer.totalDue)}. Scheduled disconnection date: ${consumer.disconnectionDate || 'N/A'}. Please settle your account or contact SAMELCO II.`;
}

async function queueReadingSms(db, invoice, reading, settings = {}) {
  const recipient = firstPhone(reading);
  if (!recipient) return { queued: false, reason: 'missing_phone' };
  return { queued: true, row: await queueSms(db, {
    idempotencyKey: `reading:${reading.AccountNumber}:${reading.BillMonth}`,
    accountNumber: reading.AccountNumber,
    eventType: 'reading',
    recipient,
    message: readingMessage(invoice, reading, settings.senderName),
    referenceId: `${reading.AccountNumber}:${reading.BillMonth}`,
  }) };
}

async function queuePaymentSms(db, payment, reading, settings = {}) {
  const recipient = firstPhone(reading);
  if (!recipient) return { queued: false, reason: 'missing_phone' };
  const reference = payment.id || payment.orNumber || payment.ornumber || Date.now();
  return { queued: true, row: await queueSms(db, {
    idempotencyKey: `payment:${reading.AccountNumber}:${reference}`,
    accountNumber: reading.AccountNumber,
    eventType: 'payment',
    recipient,
    message: paymentMessage({ ...payment, accountNumber: reading.AccountNumber }, settings.senderName),
    referenceId: String(reference),
  }) };
}

async function queueDisconnectionSms(db, consumer, record, settings = {}) {
  const recipient = firstPhone(record || consumer);
  if (!recipient) return { queued: false, reason: 'missing_phone' };
  return { queued: true, row: await queueSms(db, {
    idempotencyKey: `disconnection:${consumer.accountNumber}:${consumer.billMonth}`,
    accountNumber: consumer.accountNumber,
    eventType: 'disconnection',
    recipient,
    message: disconnectionMessage(consumer, settings.senderName),
    referenceId: `${consumer.accountNumber}:${consumer.billMonth}`,
  }) };
}

async function openSmsComposer(row) {
  const url = `sms:${row.recipient}?body=${encodeURIComponent(row.message)}`;
  if (!(await Linking.canOpenURL(url))) throw new Error('No SMS application is available on this device.');
  await Linking.openURL(url);
}

async function sendPendingSmsViaGateway(db, limit = 50) {
  if (!isApiConfigured()) throw new Error('Configure EXPO_PUBLIC_API_URL before sending bulk SMS.');
  const rows = await listSmsOutbox(db, { status: 'pending', limit });
  if (rows.length === 0) return { sent: 0, failed: 0 };
  try {
    const result = await apiJson('/api/mobile/sms/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: rows.map((row) => ({ id: row.id, idempotencyKey: row.idempotency_key, to: row.recipient, message: row.message, eventType: row.event_type })) }),
    });
    const sentIds = new Set((result?.sent || result?.messages || []).map((item) => Number(item.id)));
    for (const row of rows) {
      if (sentIds.has(Number(row.id))) await markSmsSent(db, row.id, result?.providerId || 'gateway');
    }
    return { sent: sentIds.size, failed: rows.length - sentIds.size };
  } catch (error) {
    for (const row of rows) await markSmsFailed(db, row.id, error.message);
    throw error;
  }
}

module.exports = {
  disconnectionMessage,
  firstPhone,
  normalizePhoneNumber,
  openSmsComposer,
  paymentMessage,
  queueDisconnectionSms,
  queuePaymentSms,
  queueReadingSms,
  readingMessage,
  sendPendingSmsViaGateway,
};
