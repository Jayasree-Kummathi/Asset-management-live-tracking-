import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/common/StatusBadge';
import CCEmailInput from '../components/common/CCEmailInput';
import { Download, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function ReceiveLaptop() {
  const { allocations, assets, receiveAsset } = useApp();
  const location = useLocation();
  const navigate  = useNavigate();

  const [selectedAllocId, setSelectedAllocId] = useState('');
  const [working,         setWorking]         = useState(null);
  const [damaged,         setDamaged]         = useState(null);
  const [damageDesc,      setDamageDesc]      = useState('');
  const [ccEmails,        setCCEmails]        = useState([]);
  const [submitted,       setSubmitted]       = useState(false);
  const [saving,          setSaving]          = useState(false);

  const activeAllocs = allocations.filter(a => a.status === 'Active');

  useEffect(() => {
    if (location.state?.allocationId) setSelectedAllocId(location.state.allocationId);
  }, [location.state]);

  const alloc = allocations.find(a => a.id === selectedAllocId);
  const asset  = alloc ? assets.find(a => a.id === alloc.assetId) : null;

  const getCondition = () => {
    if (working === 'yes' && damaged === 'no')  return 'good';
    if (working === 'yes' && damaged === 'yes') return 'repair';
    if (working === 'no')                       return 'scrap';
    return null;
  };
  const condition = getCondition();

  const conditionInfo = {
    good:   { label:'Return to Stock',  color:'var(--green)', icon:CheckCircle,   badge:'badge-green' },
    repair: { label:'Send to Repair',   color:'var(--amber)', icon:AlertTriangle, badge:'badge-amber' },
    scrap:  { label:'Mark as Scrap',    color:'var(--red)',   icon:XCircle,       badge:'badge-red'   },
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!alloc || !condition) return;
    setSaving(true);
    try {
      await receiveAsset(alloc.dbId, alloc.assetId, condition, damageDesc, ccEmails);
      setSubmitted(true);
      setTimeout(() => navigate('/allocation-list'), 1800);
    } catch(_) {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="fade-in" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
        <div style={{ textAlign:'center' }}>
          <CheckCircle size={56} color="var(--green)" style={{ margin:'0 auto 16px' }}/>
          <h2 style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>Laptop Received!</h2>
          <p style={{ color:'var(--text-muted)' }}>Asset processed. Notification email sent. Redirecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Receive Laptop</h1>
        <p>Process laptop returns from employees</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

          {/* Left: Select Allocation */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card">
              <div className="section-title">Select Allocation</div>
              <div className="form-group">
                <label className="form-label">Active Allocation *</label>
                <select className="form-select" required value={selectedAllocId}
                  onChange={e => { setSelectedAllocId(e.target.value); setWorking(null); setDamaged(null); setDamageDesc(''); }}>
                  <option value="">-- Select employee / allocation --</option>
                  {activeAllocs.map(a => (
                    <option key={a.id} value={a.id}>{a.empName} — {a.assetId} ({a.id})</option>
                  ))}
                </select>
              </div>

              {alloc && asset && (
                <>
                  <div className="section-title" style={{ marginTop:8 }}>Employee</div>
                  <div className="info-row"><span className="info-label">Employee ID</span><span className="info-value">{alloc.empId}</span></div>
                  <div className="info-row"><span className="info-label">Name</span><span className="info-value">{alloc.empName}</span></div>
                  <div className="info-row"><span className="info-label">Department</span><span className="info-value">{alloc.department||'—'}</span></div>
                  <div className="info-row"><span className="info-label">Project</span><span className="info-value">{alloc.project||'—'}</span></div>
                  <div className="info-row"><span className="info-label">Allocated On</span><span className="info-value" style={{ fontFamily:'var(--mono)', fontSize:12 }}>{alloc.allocationDate}</span></div>
                  <div className="section-title" style={{ marginTop:16 }}>Asset Details</div>
                  <div className="info-row"><span className="info-label">Asset Number</span><span className="info-value" style={{ color:'var(--accent)', fontFamily:'var(--mono)' }}>{asset.id}</span></div>
                  <div className="info-row"><span className="info-label">Serial Number</span><span className="info-value" style={{ fontFamily:'var(--mono)' }}>{asset.serial}</span></div>
                  <div className="info-row"><span className="info-label">Model</span><span className="info-value">{asset.brand} {asset.model}</span></div>
                  <div className="info-row"><span className="info-label">Configuration</span><span className="info-value">{asset.config}</span></div>
                  <div className="info-row"><span className="info-label">Accessories</span><span className="info-value">{alloc.accessories?.join(', ')||'None'}</span></div>
                </>
              )}
            </div>
          </div>

          {/* Right: Condition + CC */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="card">
              <div className="section-title">Condition Assessment</div>

              <div className="form-group">
                <label className="form-label">Is the Laptop Working?</label>
                <div className="radio-group">
                  <label className={`radio-option ${working==='yes'?'selected':''}`}>
                    <input type="radio" name="working" value="yes" checked={working==='yes'} onChange={()=>setWorking('yes')}/>
                    <CheckCircle size={15}/> Yes, Working
                  </label>
                  <label className={`radio-option ${working==='no'?'selected':''}`}
                    style={working==='no'?{borderColor:'var(--red)',background:'var(--red-bg)',color:'var(--red)'}:{}}>
                    <input type="radio" name="working" value="no" checked={working==='no'} onChange={()=>setWorking('no')}/>
                    <XCircle size={15}/> No, Not Working
                  </label>
                </div>
              </div>

              {working==='yes' && (
                <div className="form-group">
                  <label className="form-label">Physical Damage?</label>
                  <div className="radio-group">
                    <label className={`radio-option ${damaged==='no'?'selected':''}`}>
                      <input type="radio" name="damaged" value="no" checked={damaged==='no'} onChange={()=>setDamaged('no')}/>
                      <CheckCircle size={15}/> No Damage
                    </label>
                    <label className={`radio-option ${damaged==='yes'?'selected':''}`}
                      style={damaged==='yes'?{borderColor:'var(--amber)',background:'var(--amber-bg)',color:'var(--amber)'}:{}}>
                      <input type="radio" name="damaged" value="yes" checked={damaged==='yes'} onChange={()=>setDamaged('yes')}/>
                      <AlertTriangle size={15}/> Has Damage
                    </label>
                  </div>
                </div>
              )}

              {(damaged==='yes' || working==='no') && (
                <div className="form-group">
                  <label className="form-label">Damage / Issue Description *</label>
                  <textarea className="form-textarea" required value={damageDesc}
                    onChange={e=>setDamageDesc(e.target.value)}
                    placeholder="Describe the damage or issue observed in detail…"/>
                </div>
              )}

              {condition && (() => {
                const info = conditionInfo[condition];
                const Icon = info.icon;
                return (
                  <div style={{ padding:'14px 16px', borderRadius:'var(--radius)', border:`1px solid ${info.color}`, background:`${info.color}18`, display:'flex', alignItems:'center', gap:12, marginTop:8 }}>
                    <Icon size={20} color={info.color}/>
                    <div>
                      <div style={{ fontWeight:700, color:info.color, fontSize:13.5 }}>{info.label}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                        {condition==='good'   && 'Asset will be moved back to Stock.'}
                        {condition==='repair' && 'Asset will be moved to Repair queue.'}
                        {condition==='scrap'  && 'Asset will be permanently Scrapped.'}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* CC Emails */}
            <div className="card">
              <div className="section-title" style={{ marginBottom:10 }}>CC Emails for Notification</div>
              <CCEmailInput ccEmails={ccEmails} onChange={setCCEmails}/>
            </div>

            {/* Submit */}
            <div style={{ display:'flex', gap:10 }}>
              <button type="button" className="btn btn-secondary" style={{ flex:1 }} onClick={()=>navigate('/allocation-list')}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex:1 }} disabled={!alloc||!condition||saving}>
                <Download size={15}/> {saving?'Processing…':'Receive Laptop'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
