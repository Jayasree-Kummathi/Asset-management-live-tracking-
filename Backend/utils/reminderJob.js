/**
 * reminderJob.js
 * 
 * Daily scheduled job that:
 * 1. Finds all PENDING acceptance tokens past their due date (10 days after allocation)
 * 2. Sends reminder emails — skips already accepted/damaged tokens
 * 3. Sends escalating urgency: Reminder → Second Reminder → Final Notice
 * 4. Never sends to accepted/damaged tokens
 * 
 * Place this file in: Backend/utils/reminderJob.js
 * Start it in: Backend/server.js  →  require('./utils/reminderJob').startReminderJob()
 */

const cron   = require('node-cron');
const { query } = require('../config/db');
const { sendAcceptanceReminderEmail } = require('./emailService');

/**
 * Run once: check all pending tokens and send reminders
 */
const runReminderCheck = async () => {
  console.log('🔔 [Reminder Job] Running acceptance reminder check…');

  try {
    // Find all PENDING tokens where:
    // - status is still 'pending' (not accepted / damaged)
    // - allocation was made more than 10 days ago (past original deadline)
    // - laptop is still allocated (not returned/scrapped)
    const result = await query(
      `SELECT
         t.id,
         t.token,
         t.asset_id,
         t.emp_name,
         t.emp_email,
         t.allocation_id,
         t.reminder_count,
         t.last_reminder_at,
         t.created_at,
         t.expires_at,
         a.allocation_date,
         a.status AS alloc_status,
         ast.brand,
         ast.model,
         ast.serial
       FROM acceptance_tokens t
       LEFT JOIN allocations a  ON a.id = t.allocation_id
       LEFT JOIN assets ast     ON ast.asset_id = t.asset_id
       WHERE
         t.status = 'pending'
         AND a.status = 'Active'
         AND t.created_at < NOW() - INTERVAL '10 days'
         AND (
           t.last_reminder_at IS NULL
           OR t.last_reminder_at < NOW() - INTERVAL '7 days'
         )
       ORDER BY t.created_at ASC`
    );

    if (!result.rows.length) {
      console.log('🔔 [Reminder Job] No pending reminders needed.');
      return;
    }

    console.log(`🔔 [Reminder Job] Found ${result.rows.length} pending acceptance(s) needing reminders.`);

    for (const row of result.rows) {
      try {
        // Calculate how many days overdue
        const createdAt   = new Date(row.created_at);
        const daysElapsed = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        const daysOverdue = Math.max(0, daysElapsed - 10);
        const reminderCount = (row.reminder_count || 0) + 1;

        // Build acceptance link
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const acceptanceLink = `${baseUrl}/accept/${row.token}`;

        // Format allocation date
        const allocDate = row.allocation_date
          ? new Date(row.allocation_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
          : '—';

        console.log(`🔔 Sending reminder #${reminderCount} to ${row.emp_email} for ${row.asset_id} (${daysOverdue} days overdue)`);

        await sendAcceptanceReminderEmail({
          empName:        row.emp_name,
          empEmail:       row.emp_email,
          assetId:        row.asset_id,
          brand:          row.brand   || '',
          model:          row.model   || '',
          serial:         row.serial  || '',
          allocationDate: allocDate,
          acceptanceLink,
          daysOverdue,
        });

        // Update reminder count + last_reminder_at in DB
        await query(
          `UPDATE acceptance_tokens
           SET reminder_count    = $1,
               last_reminder_at  = NOW()
           WHERE id = $2`,
          [reminderCount, row.id]
        );

        console.log(`✅ [Reminder Job] Reminder sent to ${row.emp_email} for ${row.asset_id}`);
      } catch (err) {
        console.error(`❌ [Reminder Job] Failed for ${row.emp_email}:`, err.message);
      }
    }

    console.log('🔔 [Reminder Job] Done.');
  } catch (err) {
    console.error('❌ [Reminder Job] Fatal error:', err.message);
  }
};

/**
 * Start the cron job — runs every day at 9:00 AM server time
 */
const startReminderJob = () => {
  console.log('🔔 [Reminder Job] Scheduled — runs daily at 9:00 AM');

  // Run daily at 9:00 AM
  cron.schedule('0 9 * * *', () => {
    runReminderCheck();
  }, {
    timezone: 'Asia/Kolkata', // IST — change to your server timezone
  });

  // Also run once on startup (after 10 seconds delay to let DB connect)
  setTimeout(() => {
    runReminderCheck();
  }, 10000);
};

module.exports = { startReminderJob, runReminderCheck };