'use strict';
// Backend/utils/locationFilter.js
// ── Single source of truth for ALL location-based filtering ──────────────────
//
// HOW IT WORKS:
//   - superadmin  → sees everything, no filter applied
//   - admin/staff → sees only rows matching their managed_locations_array
//
// CASE-INSENSITIVE: All comparisons use ILIKE so that
//   "Bangalore" = "bangalore" = "Bengaluru" after normalization
//
// SPELLING NORMALIZATION:
//   All known Bangalore variants are collapsed to 'Bengaluru' in JS before
//   any DB query runs. This means even if the DB has mixed spellings,
//   the filter will still match correctly.
// ─────────────────────────────────────────────────────────────────────────────

const isSuperAdmin = (user) => user?.role === 'superadmin';

// ── Normalize a single location string ───────────────────────────────────────
// Collapses known spelling variants to their canonical form.
// Add more entries here as needed.
const CANONICAL = [
  // pattern (lowercase)          canonical spelling
  { match: /^bengaluru$/,         canonical: 'Bengaluru' },
  { match: /^bangalore$/,         canonical: 'Bengaluru' },
  { match: /^banglore$/,          canonical: 'Bengaluru' },
  { match: /^bengalore$/,         canonical: 'Bengaluru' },
  { match: /^bangalore.*remote/,  canonical: 'Bengaluru' },
  { match: /^kolkata$/,           canonical: 'Kolkata'   },
  { match: /^calcutta$/,          canonical: 'Kolkata'   },
  { match: /^mumbai$/,            canonical: 'Mumbai'    },
  { match: /^bombay$/,            canonical: 'Mumbai'    },
  { match: /^pune$/,              canonical: 'Pune'      },
  { match: /^hyderabad$/,         canonical: 'Hyderabad' },
  { match: /^delhi$/,             canonical: 'Delhi'     },
  { match: /^new delhi$/,         canonical: 'Delhi'     },
  { match: /^chennai$/,           canonical: 'Chennai'   },
  { match: /^madras$/,            canonical: 'Chennai'   },
];

const normalizeLocation = (loc) => {
  if (!loc || typeof loc !== 'string') return loc;
  const lower = loc.trim().toLowerCase();
  for (const { match, canonical } of CANONICAL) {
    if (match.test(lower)) return canonical;
  }
  return loc.trim(); // return as-is if no match
};

const normalizeLocations = (locs) =>
  locs.map(normalizeLocation).filter(Boolean);

// ── Get the locations array for this user ─────────────────────────────────────
// Returns null  → superadmin, no filter needed
// Returns array → filter to these locations (normalized)
const getUserLocations = (user) => {
  if (isSuperAdmin(user)) return null;

  // managed_locations_array is built by protect middleware
  if (Array.isArray(user?.managed_locations_array) && user.managed_locations_array.length > 0) {
    return normalizeLocations(user.managed_locations_array);
  }

  // Fallback: single location string
  if (user?.location) return [normalizeLocation(user.location)];

  return null;
};

// ── applyLocationFilter ───────────────────────────────────────────────────────
// Use this in queries that already build a conditions[] + params[] array.
// Uses ILIKE via unnest so matching is case-insensitive.
//
// @param conditions  string[]  — WHERE fragments being built
// @param params      any[]     — query parameter values
// @param idx         number    — next $N index to use
// @param user        object    — req.user
// @param column      string    — column to filter on (default: 'location')
const applyLocationFilter = (conditions, params, idx, user, column = 'location') => {
  const locs = getUserLocations(user);
  if (!locs) return idx;

  // Always use the unnest+ILIKE pattern — works for 1 or many locations,
  // and is case-insensitive so spelling variants match correctly.
  conditions.push(`${column} ILIKE ANY(SELECT unnest($${idx}::text[]))`);
  params.push(locs);
  return idx + 1;
};

// ── buildLocClause ────────────────────────────────────────────────────────────
// Use this for simple queries where you need an inline AND/WHERE clause.
// Returns { locClause, locParams } to splice into your SQL.
//
// @param user      object  — req.user
// @param startIdx  number  — the $N number to use for the location param
// @param prefix    string  — SQL keyword: 'AND' or 'WHERE' (default: 'AND')
// @param column    string  — column to filter on (default: 'location')
const buildLocClause = (user, startIdx = 1, prefix = 'AND', column = 'location') => {
  const locs = getUserLocations(user);
  if (!locs) return { locClause: '', locParams: [] };

  return {
    locClause: `${prefix} ${column} ILIKE ANY(SELECT unnest($${startIdx}::text[]))`,
    locParams: [locs],
  };
};

// ── buildEmpLocClause ─────────────────────────────────────────────────────────
// Variant that filters via the employees table join (used by access_control).
// @param user      object  — req.user
// @param empAlias  string  — table alias for employees (default: 'e')
// @param startIdx  number  — $N to start from
const buildEmpLocClause = (user, empAlias = 'e', startIdx = 1) => {
  const locs = getUserLocations(user);
  if (!locs) return { empJoin: '', empWhere: '', empLocParams: [] };

  const col  = `${empAlias}.location`;
  const cond = `${col} ILIKE ANY(SELECT unnest($${startIdx}::text[]))`;

  return {
    empJoin:      `INNER JOIN employees ${empAlias} ON ${empAlias}.emp_id = ac.emp_id AND ${cond}`,
    empWhere:     `AND ${cond}`,
    empLocParams: [locs],
  };
};

module.exports = {
  isSuperAdmin,
  getUserLocations,
  normalizeLocation,
  normalizeLocations,
  applyLocationFilter,
  buildLocClause,
  buildEmpLocClause,
};