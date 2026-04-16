const { query } = require('../config/db');

const tableMap = {
  ALO: 'allocations',
  REP: 'repairs',
  SCR: 'scraps',
};

/**
 * Generate next sequential ID: e.g. ALO-003, REP-012
 */
const generateId = async (prefix) => {
  const table = tableMap[prefix];
  const col   = prefix === 'ALO' ? 'allocation_id'
              : prefix === 'REP' ? 'repair_id'
              : 'scrap_id';

  const result = await query(`SELECT COUNT(*) AS cnt FROM ${table}`);
  const next   = Number(result.rows[0].cnt) + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
};

module.exports = generateId;
