const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { isSuperAdmin, buildLocClause, getUserLocations } = require('../utils/locationFilter');

// ── Helper: build a safe AND clause for asset-joined queries ──────────────────
// Used in queries that already JOIN assets with alias `a` or `ast`.
// Returns { clause: string, clauseParams: any[] }
// startIdx is the next $N to use.
const buildAssetLocClause = (user, alias, startIdx) => {
  if (isSuperAdmin(user)) return { clause: '', clauseParams: [] };
  const locs = getUserLocations(user);
  if (!locs || !locs.length) return { clause: '', clauseParams: [] };
  return {
    clause:       `AND ${alias}.location = ANY($${startIdx}::text[])`,
    clauseParams: [locs],
  };
};

// @route  GET /api/reports/dashboard
exports.getDashboardReport = asyncHandler(async (req, res) => {
  // ── Assets stats (filter by asset.location) ────────────────────────────────
  const { locClause, locParams } = buildLocClause(req.user, 1);

  const statsRes = await query(
    `SELECT
       COUNT(*)                                           AS total,
       COUNT(*) FILTER (WHERE status = 'Stock')          AS stock,
       COUNT(*) FILTER (WHERE status = 'Allocated')      AS allocated,
       COUNT(*) FILTER (WHERE status = 'Repair')         AS repair,
       COUNT(*) FILTER (WHERE status = 'Scrap')          AS scrap
     FROM assets WHERE 1=1 ${locClause}`,
    locParams
  );

  // ── Active allocations count (filter via joined asset location) ────────────
  const { clause: activeLocClause, clauseParams: activeLocParams } =
    buildAssetLocClause(req.user, 'a', locParams.length + 1);

  const activeRes = await query(
    `SELECT COUNT(*) AS active
     FROM allocations al
     LEFT JOIN assets a ON a.asset_id = al.asset_id
     WHERE al.status = 'Active' ${activeLocClause}`,
    activeLocParams
  );

  // ── Brand breakdown ────────────────────────────────────────────────────────
  const brandRes = await query(
    `SELECT brand AS name, COUNT(*) AS count
     FROM assets WHERE 1=1 ${locClause}
     GROUP BY brand ORDER BY count DESC`,
    locParams
  );

  // ── Location breakdown ─────────────────────────────────────────────────────
  const locationRes = await query(
    `SELECT COALESCE(location,'Unknown') AS name, COUNT(*) AS count
     FROM assets WHERE 1=1 ${locClause}
     GROUP BY location ORDER BY count DESC`,
    locParams
  );

  // ── Department breakdown (active allocations) ──────────────────────────────
  const { clause: deptLocClause, clauseParams: deptLocParams } =
    buildAssetLocClause(req.user, 'a', 1);

  const deptRes = await query(
    `SELECT COALESCE(al.department,'Unknown') AS name, COUNT(*) AS count
     FROM allocations al
     LEFT JOIN assets a ON a.asset_id = al.asset_id
     WHERE al.status = 'Active' ${deptLocClause}
     GROUP BY al.department ORDER BY count DESC`,
    deptLocParams
  );

  // ── Monthly allocations (last 6 months) ───────────────────────────────────
  const { clause: monthlyLocClause, clauseParams: monthlyLocParams } =
    buildAssetLocClause(req.user, 'a', 1);

  const monthlyRes = await query(
    `SELECT
       TO_CHAR(al.allocation_date, 'Mon') AS month,
       COUNT(*)                           AS allocated,
       COUNT(*) FILTER (WHERE al.status != 'Active') AS returned
     FROM allocations al
     LEFT JOIN assets a ON a.asset_id = al.asset_id
     WHERE al.allocation_date >= CURRENT_DATE - INTERVAL '6 months'
       ${monthlyLocClause}
     GROUP BY TO_CHAR(al.allocation_date, 'Mon'), DATE_TRUNC('month', al.allocation_date)
     ORDER BY DATE_TRUNC('month', al.allocation_date)`,
    monthlyLocParams
  );

  // ── Recent allocations (last 5) ────────────────────────────────────────────
  const { clause: recentLocClause, clauseParams: recentLocParams } =
    buildAssetLocClause(req.user, 'ast', 1);

  const recentRes = await query(
    `SELECT al.*, ast.brand, ast.model
     FROM allocations al
     LEFT JOIN assets ast ON ast.asset_id = al.asset_id
     WHERE al.status = 'Active' ${recentLocClause}
     ORDER BY al.created_at DESC LIMIT 5`,
    recentLocParams
  );

  res.json({
    success: true,
    data: {
      stats: { ...statsRes.rows[0], active_allocations: activeRes.rows[0].active },
      brandBreakdown:     brandRes.rows,
      locationBreakdown:  locationRes.rows,
      deptBreakdown:      deptRes.rows,
      monthlyAllocations: monthlyRes.rows,
      recentAllocations:  recentRes.rows,
    },
  });
});

// @route  GET /api/reports/warranty
exports.getWarrantyReport = asyncHandler(async (req, res) => {
  const { locClause, locParams } = buildLocClause(req.user, 1);

  const expiredRes = await query(
    `SELECT asset_id, serial, brand, model, warranty_end, status, location
     FROM assets
     WHERE warranty_end < CURRENT_DATE AND status != 'Scrap' ${locClause}
     ORDER BY warranty_end ASC`,
    locParams
  );

  const soonRes = await query(
    `SELECT asset_id, serial, brand, model, warranty_end, status, location
     FROM assets
     WHERE warranty_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
       AND status != 'Scrap' ${locClause}
     ORDER BY warranty_end ASC`,
    locParams
  );

  const validRes = await query(
    `SELECT COUNT(*) AS count
     FROM assets
     WHERE warranty_end > CURRENT_DATE + INTERVAL '90 days'
       AND status != 'Scrap' ${locClause}`,
    locParams
  );

  res.json({
    success: true,
    data: {
      expired:      expiredRes.rows,
      expiringSoon: soonRes.rows,
      validCount:   Number(validRes.rows[0].count),
    },
  });
});