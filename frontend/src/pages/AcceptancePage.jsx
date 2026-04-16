import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle, AlertTriangle, Upload, X, Laptop,
  User, Calendar, Package, Camera, Loader
} from 'lucide-react';
import './AcceptancePage.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function AcceptancePage() {
  const { token } = useParams();
  const fileRef   = useRef();

  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [step,       setStep]       = useState('form');
  const [hasDamage,  setHasDamage]  = useState(null);
  const [damageDesc, setDamageDesc] = useState('');
  const [photos,     setPhotos]     = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API}/acceptance/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d.data);
        else setError(d.message);
      })
      .catch(() => setError('Could not load this page. Please check your link.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotos(prev => [...prev, {
          name:    file.name,
          preview: ev.target.result,
          b64:     ev.target.result,
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (idx) => setPhotos(p => p.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasDamage === null) return;
    if (hasDamage && !damageDesc.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/acceptance/${token}/submit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          has_damage:    hasDamage,
          damage_desc:   damageDesc,
          damage_images: photos.map(p => p.b64),
        }),
      });
      const result = await res.json();
      if (result.success) setStep('success');
      else setError(result.message);
    } catch {
      setError('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Logo bar component (reused everywhere) ──────────────────────────────
  const LogoBar = () => (
    <div className="ac-logo-bar">
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <img
          src="/mindteck_logo.jpg"
          alt="Mindteck"
          className="ac-logo"
          style={{ height:38, width:'auto', objectFit:'contain' }}
          onError={e => { e.target.style.display='none'; }}
        />
        <div>
          <div className="ac-logo-text">Mindteck (India) Limited</div>
          <div className="ac-logo-sub">IT Asset Management · AssetOps</div>
        </div>
      </div>
    </div>
  );

  // ── Already submitted ───────────────────────────────────────────────────
  if (!loading && data?.status !== 'pending' && data?.status) {
    const isAccepted = data.status === 'accepted';
    return (
      <div className="ac-root">
        <div className="ac-card">
          <LogoBar />
          <div className={`ac-done ${isAccepted ? 'ac-done-ok' : 'ac-done-dmg'}`}>
            {isAccepted ? (
              <>
                <CheckCircle size={52} style={{ marginBottom:16 }}/>
                <h2>Already Accepted</h2>
                <p>
                  You confirmed receipt of this laptop on{' '}
                  {data.submitted_at?.split('T')[0]}.{' '}
                  No further action needed.
                </p>
              </>
            ) : (
              <>
                <AlertTriangle size={52} style={{ marginBottom:16 }}/>
                <h2>Damage Already Reported</h2>
                <p>
                  Your damage report was submitted on{' '}
                  {data.submitted_at?.split('T')[0]}.{' '}
                  The IT team will contact you.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Success ─────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="ac-root">
        <div className="ac-card">
          <LogoBar />
          <div className="ac-done ac-done-ok">
            <CheckCircle size={64} style={{ marginBottom:20 }}/>
            <h2>{hasDamage ? 'Damage Report Submitted' : 'Asset Accepted!'}</h2>
            <p>
              {hasDamage
                ? 'Your damage report has been received. The IT team will contact you soon.'
                : `Thank you, ${data?.emp_name?.split(' ')[0]}! You have confirmed receipt of ${data?.asset_id}. No further action needed.`
              }
            </p>
            <div className="ac-ref">
              Reference: {data?.asset_id} · {new Date().toLocaleDateString('en-IN')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="ac-root" style={{ justifyContent:'center', alignItems:'center' }}>
      <Loader size={36} className="ac-spin"/>
    </div>
  );

  // ── Error / Expired ─────────────────────────────────────────────────────
  if (error) return (
    <div className="ac-root" style={{ justifyContent:'center', alignItems:'center' }}>
      <div className="ac-card" style={{ textAlign:'center', padding:'48px 40px' }}>
        <div style={{ marginBottom:24 }}>
          <img
            src="/mindteck_logo.jpg"
            alt="Mindteck"
            style={{ height:38, width:'auto', objectFit:'contain', marginBottom:16 }}
            onError={e => { e.target.style.display='none'; }}
          />
        </div>
        <AlertTriangle size={48} style={{ color:'#f87171', marginBottom:16 }}/>
        <h2 style={{ marginBottom:8 }}>
          {error.toLowerCase().includes('expired') ? 'Link Expired' : 'Link Error'}
        </h2>
        <p style={{ color:'#6b7280', marginBottom:16 }}>{error}</p>
        {error.toLowerCase().includes('expired') && (
          <div style={{
            background:'#fef3c7', border:'1px solid #fcd34d',
            borderRadius:10, padding:'12px 20px',
            fontSize:13, color:'#92400e', marginTop:8,
          }}>
            ⚠️ This acceptance link was valid for <strong>10 days</strong> from the allocation date.
            Please contact IT at{' '}
            <a href="mailto:sysadmin@mindteck.us" style={{ color:'#1d5c3c' }}>
              sysadmin@mindteck.us
            </a>{' '}
            if you need assistance.
          </div>
        )}
      </div>
    </div>
  );

  const d = data;

  // ── Calculate days remaining ────────────────────────────────────────────
  const daysLeft = d?.expires_at
    ? Math.max(0, Math.ceil((new Date(d.expires_at) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="ac-root">
      <div className="ac-card">

        {/* Logo bar */}
        <LogoBar />

        {/* Expiry warning */}
        {daysLeft !== null && daysLeft <= 3 && daysLeft > 0 && (
          <div style={{
            background:'#fff7ed', border:'1px solid #fed7aa',
            borderRadius:8, padding:'10px 16px', margin:'0 0 16px',
            fontSize:13, color:'#c2410c', display:'flex', alignItems:'center', gap:8,
          }}>
            <AlertTriangle size={16}/>
            <span>
              This link expires in <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>.
              Please submit your response before it expires.
            </span>
          </div>
        )}

        {/* Header */}
        <div className="ac-header">
          <h1 className="ac-title">Asset Receipt Confirmation</h1>
          <p className="ac-subtitle">
            Please review your asset details and confirm receipt or report any damage.
          </p>
        </div>

        {/* Asset + Employee Details */}
        <div className="ac-details-grid">

          {/* Employee */}
          <div className="ac-detail-card">
            <div className="ac-detail-title">
              <User size={15}/> Employee Details
            </div>
            <div className="ac-row"><span>Name</span><span>{d.emp_name}</span></div>
            <div className="ac-row"><span>Employee ID</span><span>{d.emp_id}</span></div>
            <div className="ac-row"><span>Department</span><span>{d.department||'—'}</span></div>
            <div className="ac-row"><span>Mobile</span><span>{d.mobile_no||'—'}</span></div>
            <div className="ac-row"><span>Project</span><span>{d.project||'—'}</span></div>
            <div className="ac-row">
              <span>Allocation Date</span>
              <span>{d.allocation_date?.split('T')[0]}</span>
            </div>
          </div>

          {/* Asset */}
          <div className="ac-detail-card">
            <div className="ac-detail-title">
              <Laptop size={15}/> Asset Details
            </div>
            <div className="ac-row">
              <span>Asset Number</span>
              <span className="ac-assetid">{d.asset_id}</span>
            </div>
            <div className="ac-row"><span>Brand / Model</span><span>{d.brand} {d.model}</span></div>
            <div className="ac-row"><span>Configuration</span><span>{d.config}</span></div>
            <div className="ac-row">
              <span>Serial Number</span>
              <span className="ac-mono">{d.serial}</span>
            </div>
            <div className="ac-row"><span>Processor</span><span>{d.processor||'—'}</span></div>
            <div className="ac-row"><span>RAM / Storage</span><span>{d.ram} / {d.storage}</span></div>
            <div className="ac-row">
              <span>Warranty End</span>
              <span style={{ color: d.warranty_end && new Date(d.warranty_end) < new Date() ? '#f87171' : '#22c55e' }}>
                {d.warranty_end?.split('T')[0] || '—'}
              </span>
            </div>
          </div>

          {/* Accessories */}
          {(d.accessories || []).length > 0 && (
            <div className="ac-detail-card ac-full-width">
              <div className="ac-detail-title">
                <Package size={15}/> Accessories Included
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:4 }}>
                {(d.accessories || []).map(a => (
                  <span key={a} className="ac-acc-pill">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confirmation Form */}
        <form onSubmit={handleSubmit} className="ac-form">
          <div className="ac-form-title">
            <CheckCircle size={18}/> Confirm Receipt
          </div>

          <div className="ac-choice-row">
            <label className={`ac-choice ${hasDamage === false ? 'ac-choice-ok' : ''}`}>
              <input type="radio" name="damage" value="no"
                onChange={() => setHasDamage(false)} style={{ display:'none' }}/>
              <CheckCircle size={28} className="ac-choice-icon"/>
              <div className="ac-choice-label">No Damage</div>
              <div className="ac-choice-desc">Laptop received in good condition. I accept the asset.</div>
            </label>

            <label className={`ac-choice ${hasDamage === true ? 'ac-choice-dmg' : ''}`}>
              <input type="radio" name="damage" value="yes"
                onChange={() => setHasDamage(true)} style={{ display:'none' }}/>
              <AlertTriangle size={28} className="ac-choice-icon"/>
              <div className="ac-choice-label">Damage Found</div>
              <div className="ac-choice-desc">I received the laptop but found physical damage or issues.</div>
            </label>
          </div>

          {/* Damage form */}
          {hasDamage === true && (
            <div className="ac-damage-form">
              <label className="ac-label">Describe the Damage *</label>
              <textarea
                className="ac-textarea"
                required
                value={damageDesc}
                onChange={e => setDamageDesc(e.target.value)}
                placeholder="Please describe the damage in detail — location, type, severity…"
                rows={4}
              />

              <label className="ac-label" style={{ marginTop:16 }}>
                <Camera size={14} style={{ display:'inline', marginRight:6 }}/>
                Upload Damage Photos
              </label>
              <div className="ac-upload-area" onClick={() => fileRef.current?.click()}>
                <input type="file" ref={fileRef} accept="image/*" multiple
                  style={{ display:'none' }} onChange={handlePhotoUpload}/>
                <Upload size={28} style={{ margin:'0 auto 10px', display:'block', color:'#9ca3af' }}/>
                <div style={{ fontSize:14, color:'#6b7280' }}>Click to upload photos</div>
                <div style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>PNG, JPG up to 5MB each</div>
              </div>

              {photos.length > 0 && (
                <div className="ac-photos-grid">
                  {photos.map((p, i) => (
                    <div key={i} className="ac-photo-thumb">
                      <img src={p.preview} alt={p.name}/>
                      <button type="button" className="ac-photo-remove" onClick={() => removePhoto(i)}>
                        <X size={14}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No damage acceptance text */}
          {hasDamage === false && (
            <div className="ac-accept-text">
              By clicking "Confirm Acceptance" below, I confirm that I have received the laptop
              in the stated condition and agree to the terms outlined in the Employee Asset Agreement.
            </div>
          )}

          <button
            type="submit"
            className={`ac-submit ${hasDamage === null ? 'ac-submit-disabled' : hasDamage ? 'ac-submit-dmg' : 'ac-submit-ok'}`}
            disabled={hasDamage === null || submitting || (hasDamage && !damageDesc.trim())}
          >
            {submitting ? (
              <><Loader size={18} className="ac-spin"/> Submitting…</>
            ) : hasDamage ? (
              <><AlertTriangle size={18}/> Submit Damage Report</>
            ) : (
              <><CheckCircle size={18}/> Confirm Acceptance</>
            )}
          </button>
        </form>

        <div className="ac-footer">
          This link is valid for <strong>10 days</strong> from your allocation date.
          Questions? Contact{' '}
          <a href="mailto:sysadmin@mindteck.us">sysadmin@mindteck.us</a>
        </div>
      </div>
    </div>
  );
}