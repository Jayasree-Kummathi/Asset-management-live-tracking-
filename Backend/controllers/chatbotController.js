// controllers/chatbotController.js — v8 Smart Slim Prompt (stays under 6k tokens)

console.log('[chatbot] controller loaded');

const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const OpenAI = require('openai');

const safe = async (sql, params = []) => {
  try {
    const { rows } = await query(sql, params);
    return rows;
  } catch (err) {
    console.warn('[chatbot] query failed:', err.message, '|', sql.slice(0, 80));
    return [];
  }
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const daysLeft = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;

// ─────────────────────────────────────────────────────────────────────────────
// INTENT DETECTOR — what does the user actually want?
// ─────────────────────────────────────────────────────────────────────────────
function detectIntent(msg) {
  const q = msg.toLowerCase();
  const intents = [];

  // Employee lookup (by ID or name)
  if (/\b[a-z]{1,6}\d{2,8}\b/i.test(msg) && !/[-]/.test(msg)) intents.push('employee_lookup');
  // Asset lookup (by ID with dash or serial)
  if (/\b[a-z]{2,5}-\d{1,6}\b/i.test(msg) || /\b(ast|ltb)\d{3,}\b/i.test(msg)) intents.push('asset_lookup');

  if (q.match(/employe|staff|headcount|people|member/)) intents.push('employees');
  if (q.match(/asset|laptop|stock|inventory|device/)) intents.push('assets');
  if (q.match(/repair|broken|maintenance|fix/)) intents.push('repairs');
  if (q.match(/scrap|decommission|end.of.life/)) intents.push('scraps');
  if (q.match(/licen|software|seat|subscription/)) intents.push('licenses');
  if (q.match(/network|switch|router|firewall|printer|rack.?server|wifi/)) intents.push('network');
  if (q.match(/accessor|hdmi|keyboard|mouse|monitor|webcam/)) intents.push('accessories');
  if (q.match(/accept|damage|token/)) intents.push('acceptance');
  if (q.match(/user|admin|it.?staff|role|manage.?user/)) intents.push('users');
  if (q.match(/alloc|who.?has|assign/)) intents.push('allocations');
  if (q.match(/audit|log|history|activity/)) intents.push('audit');
  if (q.match(/pending|return|exit|offboard/)) intents.push('pending_returns');
  if (q.match(/warrant/)) intents.push('warranty');
  if (q.match(/alert|warning|urgent|critical|expir/)) intents.push('alerts');
  if (q.match(/overview|dashboard|summary|everything|report/)) intents.push('overview');
  if (q.match(/swap|receive|allocate.*laptop|give.*laptop/)) intents.push('operations');

  // Default: general overview if nothing matched
  if (intents.length === 0) intents.push('general');

  return [...new Set(intents)];
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART FETCH — only fetch what the intent needs
// ─────────────────────────────────────────────────────────────────────────────
async function fetchForIntents(intents, msg) {
  const data = {};
  const q = msg.toLowerCase();

  // Always get summary stats (tiny, ~5 rows)
  const [assetStats, empStats] = await Promise.all([
    safe(`SELECT COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status='Stock') AS stock,
      COUNT(*) FILTER (WHERE status='Allocated') AS allocated,
      COUNT(*) FILTER (WHERE status='Repair') AS repair,
      COUNT(*) FILTER (WHERE status='Scrap') AS scrap
      FROM assets`),
    safe(`SELECT COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status='Active') AS active,
      COUNT(*) FILTER (WHERE status='Inactive') AS inactive
      FROM employees WHERE deleted_at IS NULL`),
  ]);
  data.assetStats = assetStats[0] || {};
  data.empStats = empStats[0] || {};

  const needs = (intent) => intents.includes(intent);

  // Employee lookup — only fetch the specific employee
  if (needs('employee_lookup')) {
    const idMatch = msg.match(/\b([A-Z]{1,6}\d{2,8})\b/i);
    const nameWords = msg.replace(/\b(check|find|show|lookup|search|info|details|who is)\b/gi,'').trim();
    if (idMatch) {
      data.employees = await safe(
        `SELECT emp_id,emp_name,designation,status,location,service_line,level,client,
                reporting_manager,mobile_no,company_email,blood_group,doj,dob
         FROM employees WHERE UPPER(emp_id)=UPPER($1) AND deleted_at IS NULL`,
        [idMatch[1]]
      );
    } else if (nameWords.length >= 3) {
      data.employees = await safe(
        `SELECT emp_id,emp_name,designation,status,location,service_line,level,client,
                reporting_manager,mobile_no,company_email,blood_group,doj,dob
         FROM employees WHERE LOWER(emp_name) LIKE LOWER($1) AND deleted_at IS NULL LIMIT 5`,
        [`%${nameWords.toLowerCase()}%`]
      );
    }
    // Also get their allocations
    if (data.employees?.length > 0) {
      const ids = data.employees.map(e => e.emp_id);
      data.empAllocations = await safe(
        `SELECT al.asset_id,al.emp_id,al.emp_name,al.allocation_date,a.brand,a.model
         FROM allocations al LEFT JOIN assets a ON a.asset_id=al.asset_id
         WHERE al.emp_id=ANY($1) AND al.status='Active'`,
        [ids]
      );
      data.empLicenses = await safe(
        `SELECT la.emp_id,l.name FROM license_assignments la
         LEFT JOIN licenses l ON l.id=la.license_id WHERE la.emp_id=ANY($1)`,
        [ids]
      );
    }
  }

  // Asset lookup — only fetch the specific asset
  if (needs('asset_lookup')) {
    const idMatch = msg.match(/\b([A-Z]{2,5}-\d{1,6}|[A-Z]{2,5}\d{3,6})\b/i);
    if (idMatch) {
      data.assetDetail = await safe(
        `SELECT asset_id,brand,model,serial,config,processor,ram,storage,
                location,warranty_end,status,purchase_date
         FROM assets WHERE UPPER(asset_id)=UPPER($1) OR UPPER(serial)=UPPER($1) LIMIT 1`,
        [idMatch[1]]
      );
      if (data.assetDetail?.length > 0) {
        data.assetAllocation = await safe(
          `SELECT al.emp_id,al.emp_name,al.department,al.allocation_date
           FROM allocations al WHERE al.asset_id=UPPER($1) AND al.status='Active' LIMIT 1`,
          [data.assetDetail[0].asset_id]
        );
      }
    }
  }

  // Employees list (summary only, max 30 rows to save tokens)
  if (needs('employees') && !needs('employee_lookup')) {
    data.employees = await safe(
      `SELECT emp_id,emp_name,designation,status,location,service_line,level,client
       FROM employees WHERE deleted_at IS NULL ORDER BY emp_name LIMIT 30`
    );
    data.empByLocation = await safe(
      `SELECT location, COUNT(*) AS cnt FROM employees
       WHERE deleted_at IS NULL GROUP BY location ORDER BY cnt DESC`
    );
    data.empBySL = await safe(
      `SELECT service_line, COUNT(*) AS cnt FROM employees
       WHERE deleted_at IS NULL AND service_line IS NOT NULL
       GROUP BY service_line ORDER BY cnt DESC LIMIT 8`
    );
  }

  // Assets (summary + stock list, capped)
  if (needs('assets') && !needs('asset_lookup')) {
    data.assets = await safe(
      `SELECT asset_id,brand,model,serial,status,location,warranty_end
       FROM assets ORDER BY asset_id LIMIT 40`
    );
    data.assetByBrand = await safe(
      `SELECT brand, COUNT(*) AS cnt FROM assets GROUP BY brand ORDER BY cnt DESC`
    );
  }

  // Repairs
  if (needs('repairs')) {
    data.repairs = await safe(
      `SELECT asset_id,issue,status,repair_date,vendor,estimated_return
       FROM repairs ORDER BY created_at DESC LIMIT 20`
    );
    data.repairStats = await safe(
      `SELECT COUNT(*) FILTER (WHERE status='In Repair') AS in_repair,
              COUNT(*) FILTER (WHERE status='Completed') AS completed,
              COUNT(*) AS total FROM repairs`
    );
  }

  // Scraps
  if (needs('scraps')) {
    data.scraps = await safe(
      `SELECT asset_id,reason,scrap_date,approved_by FROM scraps ORDER BY scrap_date DESC LIMIT 15`
    );
  }

  // Licenses
  if (needs('licenses') || needs('alerts')) {
    data.licenses = await safe(
      `SELECT l.name,l.total_seats,l.expiry_date,l.category,
              COUNT(la.id) AS assigned_seats
       FROM licenses l LEFT JOIN license_assignments la ON la.license_id=l.id
       GROUP BY l.id ORDER BY l.name`
    );
  }

  // Network assets
  if (needs('network')) {
    data.networkAssets = await safe(
      `SELECT asset_id,asset_type,make,model,serial_number,ip_address,status,location
       FROM network_assets ORDER BY asset_type,asset_id LIMIT 40`
    );
    data.networkByType = await safe(
      `SELECT asset_type, COUNT(*) AS cnt,
              COUNT(*) FILTER (WHERE status='In Use') AS in_use
       FROM network_assets GROUP BY asset_type ORDER BY cnt DESC`
    );
  }

  // Accessories
  if (needs('accessories')) {
    data.accessories = await safe(
      `SELECT item_name,emp_name,quantity,status,allocation_date
       FROM accessory_allocations ORDER BY created_at DESC LIMIT 20`
    );
  }

  // Acceptance
  if (needs('acceptance')) {
    data.acceptance = await safe(
      `SELECT emp_name,asset_id,status,has_damage,submitted_at
       FROM acceptance_tokens ORDER BY created_at DESC LIMIT 20`
    );
  }

  // Users
  if (needs('users')) {
    data.users = await safe(
      `SELECT name,email,role,is_active FROM users ORDER BY role,name`
    );
  }

  // Allocations
  if (needs('allocations') || needs('operations') || needs('overview')) {
    data.allocations = await safe(
      `SELECT al.asset_id,al.emp_id,al.emp_name,al.department,
              al.allocation_date,a.brand,a.model
       FROM allocations al LEFT JOIN assets a ON a.asset_id=al.asset_id
       WHERE al.status='Active' ORDER BY al.allocation_date DESC LIMIT 20`
    );
  }

  // Pending returns
  if (needs('pending_returns') || needs('overview') || needs('alerts')) {
    data.pendingReturns = await safe(
      `SELECT emp_id,emp_name,designation,location,deleted_at
       FROM employees WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 15`
    );
  }

  // Audit logs
  if (needs('audit')) {
    data.auditLogs = await safe(
      `SELECT action,category,detail,asset_id,performed_by,created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT 15`
    );
  }

  // Warranty
  if (needs('warranty') || needs('alerts')) {
    data.warrantyExpired = await safe(
      `SELECT asset_id,brand,model,warranty_end FROM assets
       WHERE warranty_end < CURRENT_DATE ORDER BY warranty_end DESC LIMIT 10`
    );
    data.warrantyExpiring = await safe(
      `SELECT asset_id,brand,model,warranty_end FROM assets
       WHERE warranty_end BETWEEN CURRENT_DATE AND CURRENT_DATE+90
       ORDER BY warranty_end LIMIT 10`
    );
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD SLIM SYSTEM PROMPT — only includes relevant sections
// ─────────────────────────────────────────────────────────────────────────────
function buildSlimPrompt(data, intents) {
  const now = fmt(new Date());
  const needs = (i) => intents.includes(i);

  let prompt = `You are AssetOps AI for Mindteck IT Asset Management.
Answer ONLY from the data below. Never invent data.
If not found, say: "This information is not in the database."
Be concise. Use • bullets. Today: ${now}

── SUMMARY ──────────────────────────────────
Assets: Total:${data.assetStats.total||0} | Stock:${data.assetStats.stock||0} | Allocated:${data.assetStats.allocated||0} | Repair:${data.assetStats.repair||0} | Scrap:${data.assetStats.scrap||0}
Employees: Total:${data.empStats.total||0} | Active:${data.empStats.active||0} | Inactive:${data.empStats.inactive||0}
`;

  // Employee lookup
  if (data.employees?.length > 0 && (needs('employee_lookup') || needs('employees'))) {
    prompt += `\n── EMPLOYEES ────────────────────────────────\n`;
    prompt += data.employees.map(e =>
      `${e.emp_id} | ${e.emp_name} | ${e.designation||'—'} | ${e.status} | ${e.location||'—'} | SL:${e.service_line||'—'} | Level:${e.level||'—'} | Client:${e.client||'—'} | Manager:${e.reporting_manager||'—'} | Mobile:${e.mobile_no||'—'} | Email:${e.company_email||'—'} | Blood:${e.blood_group||'—'} | DOJ:${fmt(e.doj)} | DOB:${fmt(e.dob)}`
    ).join('\n');

    if (data.empAllocations?.length > 0) {
      prompt += `\n── THEIR LAPTOP ALLOCATIONS ─────────────────\n`;
      prompt += data.empAllocations.map(a => `${a.emp_id} → ${a.asset_id} | ${a.brand||''} ${a.model||''} | Since:${fmt(a.allocation_date)}`).join('\n');
    }
    if (data.empLicenses?.length > 0) {
      prompt += `\n── THEIR LICENSES ───────────────────────────\n`;
      prompt += data.empLicenses.map(l => `${l.emp_id} → ${l.name}`).join('\n');
    }
    if (data.empByLocation?.length > 0) {
      prompt += `\n── EMPLOYEES BY LOCATION ────────────────────\n`;
      prompt += data.empByLocation.map(r => `${r.location||'Unknown'}: ${r.cnt}`).join(' | ');
    }
    if (data.empBySL?.length > 0) {
      prompt += `\n── EMPLOYEES BY SERVICE LINE ────────────────\n`;
      prompt += data.empBySL.map(r => `${r.service_line}: ${r.cnt}`).join(' | ');
    }
  }

  // Asset detail
  if (data.assetDetail?.length > 0) {
    const a = data.assetDetail[0];
    prompt += `\n── ASSET DETAIL ─────────────────────────────\n`;
    prompt += `${a.asset_id} | ${a.brand||'—'} ${a.model||''} | Serial:${a.serial||'—'} | ${a.status} | Location:${a.location||'—'} | Warranty:${fmt(a.warranty_end)} | RAM:${a.ram||'—'} | Storage:${a.storage||'—'} | Processor:${a.processor||'—'} | Config:${a.config||'—'}`;
    if (data.assetAllocation?.length > 0) {
      const al = data.assetAllocation[0];
      prompt += `\nCurrently with: ${al.emp_name} (${al.emp_id}) | Dept:${al.department||'—'} | Since:${fmt(al.allocation_date)}`;
    } else {
      prompt += `\nAllocation: Not currently allocated (available in stock)`;
    }
  }

  // Assets list
  if (data.assets?.length > 0 && needs('assets')) {
    prompt += `\n── ASSETS (up to 40) ────────────────────────\n`;
    prompt += data.assets.map(a => `${a.asset_id} | ${a.brand||'—'} ${a.model||''} | ${a.status} | ${a.location||'—'} | Warranty:${fmt(a.warranty_end)}`).join('\n');
    if (data.assetByBrand?.length > 0) {
      prompt += `\n── BY BRAND ─────────────────────────────────\n`;
      prompt += data.assetByBrand.map(r => `${r.brand||'Unknown'}: ${r.cnt}`).join(' | ');
    }
  }

  // Repairs
  if (data.repairs?.length >= 0 && needs('repairs')) {
    const rs = data.repairStats?.[0] || {};
    prompt += `\n── REPAIRS ──────────────────────────────────\n`;
    prompt += `In Repair:${rs.in_repair||0} | Completed:${rs.completed||0} | Total:${rs.total||0}\n`;
    prompt += (data.repairs||[]).map(r => `${r.asset_id} | ${r.status} | Issue:${r.issue||'—'} | Vendor:${r.vendor||'—'} | Since:${fmt(r.repair_date)}`).join('\n') || 'None';
  }

  // Scraps
  if (data.scraps && needs('scraps')) {
    prompt += `\n── SCRAPS (${data.scraps.length}) ───────────────────────────\n`;
    prompt += data.scraps.map(s => `${s.asset_id} | Reason:${s.reason||'—'} | Date:${fmt(s.scrap_date)} | By:${s.approved_by||'—'}`).join('\n') || 'None';
  }

  // Licenses
  if (data.licenses?.length >= 0 && (needs('licenses') || needs('alerts'))) {
    const licFull     = (data.licenses||[]).filter(l => l.total_seats>0 && Number(l.assigned_seats)>=Number(l.total_seats));
    const licExpiring = (data.licenses||[]).filter(l => { const d=daysLeft(l.expiry_date); return d!==null&&d>=0&&d<=30; });
    const licExpired  = (data.licenses||[]).filter(l => { const d=daysLeft(l.expiry_date); return d!==null&&d<0; });
    prompt += `\n── LICENSES ─────────────────────────────────\n`;
    prompt += `Full:${licFull.length} | Expiring≤30d:${licExpiring.length} | Expired:${licExpired.length}\n`;
    prompt += (data.licenses||[]).map(l => {
      const d=daysLeft(l.expiry_date);
      const flag=licFull.find(f=>f.name===l.name)?'🔴FULL':d!==null&&d<0?'❌EXPIRED':d!==null&&d<=30?`⚠️EXP_IN_${d}d`:'🟢OK';
      return `${l.name} | ${l.assigned_seats}/${l.total_seats||'∞'} seats | Expiry:${fmt(l.expiry_date)} | ${flag} | Cat:${l.category||'—'}`;
    }).join('\n') || 'None';
  }

  // Network
  if (data.networkAssets && needs('network')) {
    prompt += `\n── NETWORK ASSETS ───────────────────────────\n`;
    if (data.networkByType?.length > 0) {
      prompt += data.networkByType.map(r => `${r.asset_type}: Total=${r.cnt}, InUse=${r.in_use}`).join(' | ') + '\n';
    }
    prompt += data.networkAssets.map(n => `${n.asset_id} | Type:${n.asset_type} | ${n.make||'—'} ${n.model||''} | Serial:${n.serial_number||'—'} | IP:${n.ip_address||'—'} | ${n.status} | ${n.location||'—'}`).join('\n') || 'None';
  }

  // Accessories
  if (data.accessories && needs('accessories')) {
    prompt += `\n── ACCESSORIES ──────────────────────────────\n`;
    prompt += data.accessories.map(a => `${a.item_name} → ${a.emp_name||'—'} | Qty:${a.quantity} | ${a.status}`).join('\n') || 'None';
  }

  // Acceptance
  if (data.acceptance && needs('acceptance')) {
    prompt += `\n── ACCEPTANCE TRACKER ───────────────────────\n`;
    const pending  = data.acceptance.filter(t=>t.status==='pending').length;
    const damaged  = data.acceptance.filter(t=>t.has_damage).length;
    prompt += `Pending:${pending} | Damaged:${damaged}\n`;
    prompt += data.acceptance.map(t => `${t.emp_name} | Asset:${t.asset_id} | Status:${t.status} | Damage:${t.has_damage?'YES':'No'}`).join('\n') || 'None';
  }

  // Users
  if (data.users && needs('users')) {
    const admins   = data.users.filter(u=>/admin/i.test(u.role));
    const itStaff  = data.users.filter(u=>/it.?staff/i.test(u.role));
    const empUsers = data.users.filter(u=>/^employee$/i.test(u.role));
    prompt += `\n── SYSTEM USERS (${data.users.length}) ──────────────────────\n`;
    prompt += `Admins:${admins.length} | IT Staff:${itStaff.length} | Employees:${empUsers.length}\n`;
    prompt += data.users.map(u => `${u.name} | ${u.email} | Role:${u.role} | Active:${u.is_active?'Yes':'No'}`).join('\n') || 'None';
  }

  // Allocations
  if (data.allocations && (needs('allocations') || needs('operations') || needs('overview'))) {
    prompt += `\n── ACTIVE ALLOCATIONS (${data.allocations.length}) ──────────────\n`;
    prompt += data.allocations.map(a => `${a.asset_id} → ${a.emp_name} (${a.emp_id}) | Dept:${a.department||'—'} | ${a.brand||''} ${a.model||''} | Since:${fmt(a.allocation_date)}`).join('\n') || 'None';
  }

  // Pending returns
  if (data.pendingReturns && (needs('pending_returns') || needs('overview') || needs('alerts'))) {
    prompt += `\n── PENDING LAPTOP RETURNS (${data.pendingReturns.length}) ─────────\n`;
    prompt += data.pendingReturns.map(e => `${e.emp_id} | ${e.emp_name} | ${e.designation||'—'} | ${e.location||'—'} | Exited:${fmt(e.deleted_at)}`).join('\n') || 'None';
  }

  // Audit logs
  if (data.auditLogs && needs('audit')) {
    prompt += `\n── RECENT AUDIT LOGS ────────────────────────\n`;
    prompt += data.auditLogs.map(l => `${fmt(l.created_at)} | ${l.action} | ${l.detail} | By:${l.performed_by||'—'}`).join('\n') || 'None';
  }

  // Warranty
  if ((data.warrantyExpired || data.warrantyExpiring) && (needs('warranty') || needs('alerts'))) {
    prompt += `\n── WARRANTY ─────────────────────────────────\n`;
    if (data.warrantyExpired?.length > 0) {
      prompt += `Expired (${data.warrantyExpired.length}): ` + data.warrantyExpired.map(a=>`${a.asset_id}(${fmt(a.warranty_end)})`).join(', ') + '\n';
    }
    if (data.warrantyExpiring?.length > 0) {
      prompt += `Expiring within 90d (${data.warrantyExpiring.length}): ` + data.warrantyExpiring.map(a=>`${a.asset_id}(${fmt(a.warranty_end)})`).join(', ');
    }
  }

  prompt += `\n\nRULES: Use ONLY data above. Never invent. If not found say "not in database". Use • bullets.`;
  return prompt;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chatbot/ask
// ─────────────────────────────────────────────────────────────────────────────
const ask = asyncHandler(async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, message: 'GROQ_API_KEY not set in .env file' });
  }

  // Detect intent and fetch only relevant data
  const intents = detectIntent(message);
  console.log(`[chatbot] intents: ${intents.join(', ')} for: "${message.slice(0,60)}"`);

  const data = await fetchForIntents(intents, message);
  const systemPrompt = buildSlimPrompt(data, intents);

  // Log approximate token count (4 chars ≈ 1 token)
  const approxTokens = Math.ceil(systemPrompt.length / 4);
  console.log(`[chatbot] prompt ~${approxTokens} tokens (${systemPrompt.length} chars)`);

  // Keep only last 4 history messages to save tokens
  const recentHistory = history.slice(-4).map(m => ({
    role:    m.role === 'user' ? 'user' : 'assistant',
    content: String(m.content || '').slice(0, 400), // trim long AI responses
  }));

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  let completion;
  try {
    completion = await client.chat.completions.create({
      model:       'llama-3.1-8b-instant',
      temperature: 0.2,
      max_tokens:  512,
      messages: [
        { role: 'system', content: systemPrompt },
        ...recentHistory,
        { role: 'user',   content: message },
      ],
    });
  } catch (err) {
    console.error('[Groq Error]', err.message);

    // If still too large, use a minimal fallback prompt
    if (err.message?.includes('413') || err.message?.includes('too large')) {
      console.log('[chatbot] Falling back to minimal prompt');
      try {
        const minimalPrompt = `You are AssetOps AI for Mindteck.
Assets: Total:${data.assetStats.total||0} Stock:${data.assetStats.stock||0} Allocated:${data.assetStats.allocated||0} Repair:${data.assetStats.repair||0}
Employees: Total:${data.empStats.total||0} Active:${data.empStats.active||0}
Answer helpfully. If you need specific data not shown, direct user to check the relevant page.`;

        completion = await client.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          temperature: 0.2,
          max_tokens: 300,
          messages: [
            { role: 'system', content: minimalPrompt },
            { role: 'user',   content: message },
          ],
        });
      } catch (err2) {
        return res.status(502).json({ success: false, message: 'AI service error. Please try again.' });
      }
    } else {
      return res.status(502).json({ success: false, message: 'Groq AI service error: ' + err.message });
    }
  }

  const reply = completion.choices?.[0]?.message?.content || 'No response from AI.';
  res.json({ success: true, reply });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chatbot/context?page=<page>
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_FETCH_MAP = {
  dashboard:  ['assetStats','employeeSummary','pendingReturns','alerts'],
  receive:    ['assetStats','activeAllocations','pendingReturns'],
  swap:       ['assetStats','activeAllocations'],
  allocate:   ['stockAssets','employeeSummary'],
  repair:     ['repairStats','scrapStats'],
  employees:  ['employeeSummary','pendingReturns'],
  inventory:  ['assetStats','stockAssets','warrantyAlerts'],
  licenses:   ['licenseStats'],
  network:    ['networkStats'],
  default:    ['assetStats','employeeSummary'],
};

const FETCHERS = {
  async assetStats() {
    const r = await safe(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='Stock') AS stock, COUNT(*) FILTER (WHERE status='Allocated') AS allocated, COUNT(*) FILTER (WHERE status='Repair') AS repair, COUNT(*) FILTER (WHERE status='Scrap') AS scrap FROM assets`);
    return { assetStats: r[0] || {} };
  },
  async stockAssets() {
    const r = await safe(`SELECT asset_id,brand,model,serial,config,location,warranty_end,status FROM assets WHERE status='Stock' ORDER BY asset_id`);
    return { stockAssets: r };
  },
  async activeAllocations() {
    const r = await safe(`SELECT al.asset_id,al.emp_id,al.emp_name,al.department,al.allocation_date,al.status,a.brand,a.model FROM allocations al LEFT JOIN assets a ON a.asset_id=al.asset_id WHERE al.status='Active' ORDER BY al.allocation_date DESC`);
    return { activeAllocations: r };
  },
  async pendingReturns() {
    const r = await safe(`SELECT emp_id,emp_name,designation,location,deleted_at FROM employees WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`);
    return { pendingReturns: r };
  },
  async repairStats() {
    const counts = await safe(`SELECT COUNT(*) FILTER (WHERE status='In Repair') AS in_repair, COUNT(*) FILTER (WHERE status='Completed') AS completed, COUNT(*) AS total FROM repairs`);
    const recent = await safe(`SELECT asset_id,issue,status,repair_date,vendor FROM repairs WHERE status='In Repair' ORDER BY repair_date DESC LIMIT 15`);
    return { repairStats: { ...counts[0], recent } };
  },
  async scrapStats() {
    const c = await safe(`SELECT COUNT(*) AS total FROM scraps`);
    const r = await safe(`SELECT asset_id,reason,scrap_date FROM scraps ORDER BY scrap_date DESC LIMIT 10`);
    return { scrapStats: { total: c[0]?.total, recent: r } };
  },
  async employeeSummary() {
    const r = await safe(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='Active') AS active, COUNT(*) FILTER (WHERE status='Inactive') AS inactive, COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS exited FROM employees`);
    return { employeeSummary: r[0] || {} };
  },
  async licenseStats() {
    const licenses = await safe(`SELECT l.id,l.name,l.total_seats,l.expiry_date,COUNT(la.id) AS assigned_seats FROM licenses l LEFT JOIN license_assignments la ON la.license_id=l.id GROUP BY l.id ORDER BY l.name`);
    const now=new Date(), in30=new Date(now.getTime()+30*86400000);
    return { licenseStats: { total:licenses.length, full:licenses.filter(l=>l.total_seats>0&&Number(l.assigned_seats)>=Number(l.total_seats)).length, expiring:licenses.filter(l=>l.expiry_date&&new Date(l.expiry_date)>now&&new Date(l.expiry_date)<=in30).length, expired:licenses.filter(l=>l.expiry_date&&new Date(l.expiry_date)<now).length, licenses } };
  },
  async warrantyAlerts() {
    const exp  = await safe(`SELECT asset_id,brand,model,warranty_end,status FROM assets WHERE warranty_end>=CURRENT_DATE AND warranty_end<=CURRENT_DATE+INTERVAL '90 days' ORDER BY warranty_end`);
    const expr = await safe(`SELECT asset_id,brand,model,warranty_end,status FROM assets WHERE warranty_end<CURRENT_DATE ORDER BY warranty_end DESC LIMIT 20`);
    return { warrantyAlerts: { expiring: exp, expired: expr } };
  },
  async networkStats() {
    const c = await safe(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='In Use') AS in_use FROM network_assets`);
    const d = await safe(`SELECT asset_id,asset_type,make,brand,model,serial_number,ip_address,status,location FROM network_assets ORDER BY asset_id`);
    return { networkStats: { total:c[0]?.total, in_use:c[0]?.in_use, devices: d } };
  },
  async alerts() {
    const [s,p,el,exl,r,a] = await Promise.all([
      safe(`SELECT COUNT(*) AS cnt FROM assets WHERE status='Stock'`),
      safe(`SELECT COUNT(*) AS cnt FROM employees WHERE deleted_at IS NOT NULL`),
      safe(`SELECT COUNT(*) AS cnt FROM licenses WHERE expiry_date<CURRENT_DATE`),
      safe(`SELECT COUNT(*) AS cnt FROM licenses WHERE expiry_date>=CURRENT_DATE AND expiry_date<=CURRENT_DATE+INTERVAL '30 days'`),
      safe(`SELECT COUNT(*) AS cnt FROM repairs WHERE status='In Repair'`),
      safe(`SELECT COUNT(*) AS cnt FROM acceptance_tokens WHERE status='pending'`),
    ]);
    return { alerts: { lowStock:Number(s[0]?.cnt)<5?Number(s[0]?.cnt):null, pendingReturns:Number(p[0]?.cnt)||null, expiredLicenses:Number(el[0]?.cnt)||null, expiringLicenses:Number(exl[0]?.cnt)||null, highRepairVolume:Number(r[0]?.cnt)>5?Number(r[0]?.cnt):null, acceptancePending:Number(a[0]?.cnt)>5?Number(a[0]?.cnt):null } };
  },
};

const getContext = asyncHandler(async (req, res) => {
  const page    = (req.query.page || 'default').toLowerCase().trim();
  const keys    = PAGE_FETCH_MAP[page] || PAGE_FETCH_MAP.default;
  const allKeys = [...new Set(['assetStats','employeeSummary', ...keys])];
  const results = await Promise.allSettled(allKeys.map(k => FETCHERS[k]?.() || Promise.resolve({})));
  const data    = { page };
  results.forEach(r => { if (r.status === 'fulfilled') Object.assign(data, r.value); });
  res.json({ success: true, data });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chatbot/search?q=<query>
// ─────────────────────────────────────────────────────────────────────────────
const search = asyncHandler(async (req, res) => {
  const raw = (req.query.q || '').trim();
  if (!raw || raw.length < 2) return res.json({ success: true, employees: [], assets: [] });

  const likeQ  = `%${raw.toLowerCase()}%`;
  const startQ = `${raw.toUpperCase()}%`;

  const [empResult, assetResult] = await Promise.all([
    query(
      `SELECT emp_id, emp_name, designation, status, location, service_line,
              company_email, mobile_no, level, client, reporting_manager,
              blood_group, doj, dob
       FROM   employees
       WHERE  deleted_at IS NULL
         AND  (LOWER(emp_name) LIKE $1 OR UPPER(emp_id) LIKE $2)
       ORDER  BY CASE WHEN UPPER(emp_id) LIKE $2 THEN 0 ELSE 1 END, emp_name
       LIMIT  6`,
      [likeQ, startQ]
    ).catch(() => ({ rows: [] })),

    query(
      `SELECT asset_id, brand, model, serial, status, location,
              warranty_end, config, processor, ram, storage
       FROM   assets
       WHERE  UPPER(asset_id) LIKE $1 OR UPPER(serial) = UPPER($2)
       ORDER  BY asset_id
       LIMIT  4`,
      [startQ, raw]
    ).catch(() => ({ rows: [] })),
  ]);

  res.json({
    success:   true,
    employees: empResult.rows  || [],
    assets:    assetResult.rows || [],
  });
});

const parseEmployee = asyncHandler(async (req, res) => {
  const { rawText } = req.body;
 
  if (!rawText?.trim()) {
    return res.status(400).json({ success: false, message: 'rawText is required' });
  }
 
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, message: 'GROQ_API_KEY not set' });
  }
 
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });
 
  const systemPrompt = `You are an HR data parser. Extract employee details from pasted Excel/spreadsheet data.
 
RULES:
- Return ONLY valid JSON, no explanation, no markdown, no backticks
- Normalize ALL dates to YYYY-MM-DD format
  - "25-05-2026" → "2026-05-25"
  - "21-May-26" → "2026-05-21"
  - "9/18/1997" → "1997-09-18"
  - "13-Jan-1995" → "1995-01-13"
- The company email is typically firstname.lastname@mindteck.com or similar corporate domain
- The personal email is gmail/yahoo/hotmail etc
- Fix obvious typos: "Inside Sates" → "Inside Sales"
- "Service Line & Department" maps to serviceLine
- Normalize blood group: "A+ve" → "A+", "O+ve" → "O+", "B-ve" → "B-"
- If a field is not found, use null (not empty string)
- empId is usually alphanumeric like IBE2897, MT001 etc
 
Return EXACTLY this JSON shape:
{
  "empId": "",
  "name": "",
  "doj": "",
  "dob": "",
  "level": "",
  "designation": "",
  "location": "",
  "mobile": "",
  "serviceLine": "",
  "client": null,
  "manager": "",
  "suggestedEmail": "",
  "personalEmail": "",
  "bloodGroup": "",
  "cif": null
}`;
 
  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      max_tokens: 400,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawText.trim() },
      ],
    });
 
    const raw = completion.choices?.[0]?.message?.content || '';
 
    // Strip any accidental markdown fences
    const cleaned = raw
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
 
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('[parseEmployee] JSON parse failed. Raw output:', raw);
      return res.status(422).json({
        success: false,
        message: 'AI returned invalid JSON. Try pasting header row + data row only.',
        raw,
      });
    }
 
    // Sanitize — ensure all keys exist
    const result = {
      empId:          (parsed.empId         || '').toString().toUpperCase().trim(),
      name:           parsed.name           || '',
      doj:            parsed.doj            || '',
      dob:            parsed.dob            || '',
      level:          parsed.level          || '',
      designation:    parsed.designation    || '',
      location:       parsed.location       || '',
      mobile:         (parsed.mobile        || '').toString().trim(),
      serviceLine:    parsed.serviceLine    || '',
      client:         parsed.client         || null,
      manager:        parsed.manager        || '',
      suggestedEmail: parsed.suggestedEmail || '',
      personalEmail:  parsed.personalEmail  || '',
      bloodGroup:     parsed.bloodGroup     || '',
      cif:            parsed.cif            || null,
    };
 
  
    return res.json({ success: true, data: result });
 
  } catch (err) {
    console.error('[parseEmployee] Groq error:', err.message);
    return res.status(502).json({
      success: false,
      message: 'AI parse failed: ' + err.message,
    });
  }
});
 
module.exports = { getContext, search, ask,parseEmployee };