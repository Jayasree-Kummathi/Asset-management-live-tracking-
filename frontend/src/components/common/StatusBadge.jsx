import React from 'react';

const statusConfig = {
  Stock:     { cls: 'badge-green',  dot: '#34d399' },
  Allocated: { cls: 'badge-blue',   dot: '#4f8ef7' },
  Repair:    { cls: 'badge-amber',  dot: '#fbbf24' },
  Scrap:     { cls: 'badge-red',    dot: '#f87171' },
  Active:    { cls: 'badge-green',  dot: '#34d399' },
  Returned:  { cls: 'badge-gray',   dot: '#6b7490' },
  Swapped:   { cls: 'badge-purple', dot: '#a78bfa' },
  'In Repair':{ cls: 'badge-amber', dot: '#fbbf24' },
  Completed: { cls: 'badge-green',  dot: '#34d399' },
};

export default function StatusBadge({ status }) {
  const cfg = statusConfig[status] || { cls: 'badge-gray', dot: '#6b7490' };
  return (
    <span className={`badge ${cfg.cls}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
      {status}
    </span>
  );
}
