import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext();

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiFetch = async (path, options = {}) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'API error');
  return data;
};

// ── Normalizers ───────────────────────────────────────────────────────────────
const normalizeAsset = (a) => ({
  id:            a.asset_id,
  serial:        a.serial,
  brand:         a.brand,
  model:         a.model,
  config:        a.config,
  processor:     a.processor,
  ram:           a.ram,
  storage:       a.storage,
  purchaseDate:  a.purchase_date?.split('T')[0],
  warrantyStart: a.warranty_start?.split('T')[0],
  warrantyEnd:   a.warranty_end?.split('T')[0],
  vendor:        a.vendor,
  location:      a.location,
  notes:         a.notes,
  status:        a.status,
});

const normalizeAllocation = (a) => ({
  id:              a.allocation_id,
  dbId:            a.id,
  empId:           a.emp_id,
  empName:         a.emp_name,
  empEmail:        a.emp_email,
  department:      a.department,
  client:          a.client,
  project:         a.project,
  assetId:         a.asset_id,
  allocationDate:  a.allocation_date?.split('T')[0],
  returnDate:      a.return_date?.split('T')[0],
  accessories:     a.accessories || [],
  status:          a.status,
  brand:           a.brand,
  model:           a.model,
  config:          a.config,
  mobileNo:        a.mobile_no        || '',
  personalEmail:   a.personal_email   || '',
  photoUrl:        a.photo_url        || '',
  deliveryMethod:  a.delivery_method  || 'hand',
  deliveryAddress: a.delivery_address || '',
  notes:           a.notes            || '',
  // ── FIX: map prepared_by snake_case → camelCase ──
  preparedBy:      a.prepared_by      || '',
  allocatedBy:     a.allocated_by     || a.prepared_by || '',
  // ── FIX: keep damage photos raw string for parsing in UI ──
  damagePhotos:    a.damage_photos    || '[]',
});

const normalizeRepair = (r) => ({
  id:              r.repair_id,
  dbId:            r.id,
  assetId:         r.asset_id,
  serial:          r.serial,
  issue:           r.issue,
  vendor:          r.vendor,
  repairDate:      r.repair_date?.split('T')[0],
  estimatedReturn: r.estimated_return?.split('T')[0],
  status:          r.status,
  notes:           r.notes,
  brand:           r.brand,
  model:           r.model,
});

const normalizeScrap = (s) => ({
  id:         s.scrap_id,
  dbId:       s.id,
  assetId:    s.asset_id,
  serial:     s.serial,
  model:      s.model,
  scrapDate:  s.scrap_date?.split('T')[0],
  reason:     s.reason,
  approvedBy: s.approved_by,
  brand:      s.brand,
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  const [assets,      setAssets]      = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [repairs,     setRepairs]     = useState([]);
  const [scraps,      setScraps]      = useState([]);
  const [stats,       setStats]       = useState({ total:0, stock:0, allocated:0, repair:0, scrap:0 });
  const [loading,     setLoading]     = useState(true);
  const [toasts,      setToasts]      = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [assetsRes, allocsRes, repairsRes, scrapsRes, statsRes] = await Promise.all([
       apiFetch('/assets?limit=10000'),
       apiFetch('/allocations?limit=10000'),
        apiFetch('/repairs'),
        apiFetch('/scraps'),
        apiFetch('/assets/stats'),
      ]);
      setAssets(assetsRes.data.map(normalizeAsset));
      setAllocations(allocsRes.data.map(normalizeAllocation));
      setRepairs(repairsRes.data.map(normalizeRepair));
      setScraps(scrapsRes.data.map(normalizeScrap));
      const s = statsRes.data;
      setStats({
        total:     Number(s.total),
        stock:     Number(s.stock),
        allocated: Number(s.allocated),
        repair:    Number(s.repair),
        scrap:     Number(s.scrap),
      });
    } catch (err) {
      showToast(err.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Add Asset ─────────────────────────────────────────────────────────────
  const addAsset = async (formData) => {
    try {
      await apiFetch('/assets', {
        method: 'POST',
        body: JSON.stringify({
          asset_id:       formData.id,
          serial:         formData.serial,
          brand:          formData.brand,
          model:          formData.model,
          config:         formData.config,
          processor:      formData.processor,
          ram:            formData.ram,
          storage:        formData.storage,
          purchase_date:  formData.purchaseDate  || null,
          warranty_start: formData.warrantyStart || null,
          warranty_end:   formData.warrantyEnd   || null,
          vendor:         formData.vendor,
          location:       formData.location,
          notes:          formData.notes,
        }),
      });
      showToast('Asset added successfully');
      await fetchAll();
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // ── Allocate Asset ────────────────────────────────────────────────────────
  // FIX: forwards prepared_by, damage_photos array properly
  const allocateAsset = async (assetId, formData) => {
    try {
      await apiFetch('/allocations', {
        method: 'POST',
        body: JSON.stringify({
          asset_id:         assetId,
          emp_id:           formData.empId,
          emp_name:         formData.empName,
          emp_email:        formData.empEmail,
          department:       formData.department,
          client:           formData.client,
          project:          formData.project,
          allocation_date:  formData.allocationDate,
          accessories:      formData.accessories      || [],
          extra_ccs:        formData.extra_ccs        || [],
          mobile_no:        formData.mobileNo         || '',
          personal_email:   formData.personalEmail    || '',
          photo_url:        formData.photoUrl         || '',
          delivery_method:  formData.deliveryMethod   || 'hand',
          delivery_address: formData.deliveryAddress  || '',
          accessoryDetails: formData.accessoryDetails || [],
          // FIX: always send prepared_by
          prepared_by:      formData.prepared_by || formData.preparedBy || '',
          // FIX: damage_photos — accept both JSON string and array
          damage_photos:    Array.isArray(formData.damage_photos)
                              ? JSON.stringify(formData.damage_photos)
                              : (formData.damage_photos || '[]'),
        }),
      });
      showToast('Laptop allocated successfully');
      await fetchAll();
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // ── Receive Asset ─────────────────────────────────────────────────────────
  // FIX: added returnPhotos parameter
  const receiveAsset = async (
    allocationId,
    assetId,
    condition,
    damageDesc   = '',
    extraCCs     = [],
    returnPhotos = [],   // ← NEW: array of base64 strings from ReceiveLaptop
  ) => {
    try {
      await apiFetch(`/allocations/${allocationId}/receive`, {
        method: 'PUT',
        body: JSON.stringify({
          condition,
          damage_description: damageDesc,
          extra_ccs:          extraCCs,
          return_photos:      returnPhotos,  // ← sent to backend → forwarded in email
        }),
      });
      showToast('Laptop received and processed');
      await fetchAll();
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // ── Swap Asset ────────────────────────────────────────────────────────────
  // FIX: forwards issue_images and prepared_by
  const swapAsset = async (allocationDbId, oldAssetId, newAssetId, swapData) => {
    try {
      await apiFetch(`/allocations/${allocationDbId}/swap`, {
        method: 'PUT',
        body: JSON.stringify({
          new_asset_id:      newAssetId,
          issue_type:        swapData.issueType,
          issue_description: swapData.issueDesc,
          old_condition:     swapData.oldCondition,
          extra_ccs:         swapData.extra_ccs  || [],
          prepared_by:       swapData.preparedBy || '',
          // FIX: issue images from swap form
          issue_images:      swapData.issueImages || [],
        }),
      });
      showToast('Laptop swapped successfully');
      await fetchAll();
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  return (
    <AppContext.Provider value={{
      assets, allocations, repairs, scraps, stats,
      loading, toasts,
      addAsset, allocateAsset, receiveAsset, swapAsset,
      showToast, refetch: fetchAll,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);