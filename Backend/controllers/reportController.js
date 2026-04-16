const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// @route  GET /api/reports/dashboard
exports.getDashboardReport = asyncHandler(async (req, res) => {
  // Asset counts
  const statsRes = await query(`
    SELECT
      COUNT(*)                                           AS total,
      COUNT(*) FILTER (WHERE status = 'Stock')          AS stock,
      COUNT(*) FILTER (WHERE status = 'Allocated')      AS allocated,
      COUNT(*) FILTER (WHERE status = 'Repair')         AS repair,
      COUNT(*) FILTER (WHERE status = 'Scrap')          AS scrap
    FROM assets
  `);

  // Active allocations
  const activeRes = await query(
    `SELECT COUNT(*) AS active FROM allocations WHERE status = 'Active'`
  );

  // Brand breakdown
  const brandRes = await query(
    `SELECT brand AS name, COUNT(*) AS count FROM assets GROUP BY brand ORDER BY count DESC`
  );

  // Location breakdown
  const locationRes = await query(
    `SELECT COALESCE(location,'Unknown') AS name, COUNT(*) AS count
     FROM assets GROUP BY location ORDER BY count DESC`
  );

  // Department breakdown of active allocations
  const deptRes = await query(
    `SELECT COALESCE(department,'Unknown') AS name, COUNT(*) AS count
     FROM allocations WHERE status = 'Active'
     GROUP BY department ORDER BY count DESC`
  );

  // Monthly allocation trend (last 6 months)
  const monthlyRes = await query(`
    SELECT
      TO_CHAR(allocation_date, 'Mon') AS month,
      COUNT(*)                        AS allocated,
      COUNT(*) FILTER (WHERE status != 'Active') AS returned
    FROM allocations
    WHERE allocation_date >= CURRENT_DATE - INTERVAL '6 months'
    GROUP BY TO_CHAR(allocation_date, 'Mon'),
             DATE_TRUNC('month', allocation_date)
    ORDER BY DATE_TRUNC('month', allocation_date)
  `);

  // Recent active allocations
  const recentRes = await query(`
    SELECT a.*, ast.brand, ast.model
    FROM allocations a
    LEFT JOIN assets ast ON ast.asset_id = a.asset_id
    WHERE a.status = 'Active'
    ORDER BY a.created_at DESC
    LIMIT 5
  `);

  res.json({
    success: true,
    data: {
      stats: {
        ...statsRes.rows[0],
        active_allocations: activeRes.rows[0].active,
      },
      brandBreakdown:    brandRes.rows,
      locationBreakdown: locationRes.rows,
      deptBreakdown:     deptRes.rows,
      monthlyAllocations: monthlyRes.rows,
      recentAllocations:  recentRes.rows,
    },
  });
});

// @route  GET /api/reports/warranty
exports.getWarrantyReport = asyncHandler(async (req, res) => {
  const expiredRes = await query(`
    SELECT asset_id, serial, brand, model, warranty_end, status
    FROM assets
    WHERE warranty_end < CURRENT_DATE AND status != 'Scrap'
    ORDER BY warranty_end ASC
  `);

  const soonRes = await query(`
    SELECT asset_id, serial, brand, model, warranty_end, status
    FROM assets
    WHERE warranty_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
      AND status != 'Scrap'
    ORDER BY warranty_end ASC
  `);

  const validRes = await query(`
    SELECT COUNT(*) AS count
    FROM assets
    WHERE warranty_end > CURRENT_DATE + INTERVAL '90 days' AND status != 'Scrap'
  `);

  res.json({
    success: true,
    data: {
      expired:     expiredRes.rows,
      expiringSoon: soonRes.rows,
      validCount:  Number(validRes.rows[0].count),
    },
  });
});
