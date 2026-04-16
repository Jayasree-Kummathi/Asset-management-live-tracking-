import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { Camera, X } from 'lucide-react';

export default function BarcodeScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    startScan();
    return () => readerRef.current?.reset();
  }, []);

  const startScan = async () => {
    setScanning(true);
    setError('');
    try {
      const reader = new BrowserQRCodeReader();
      readerRef.current = reader;
      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      // Prefer rear camera on mobile
      const device = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[0];
      await reader.decodeFromVideoDevice(device?.deviceId, videoRef.current, (result, err) => {
        if (result) {
          parseScanResult(result.getText());
        }
      });
    } catch (e) {
      setError('Camera access denied or not available.');
    }
  };

  const parseScanResult = (text) => {
    readerRef.current?.reset();
    // Supports both formats:
    // 1. URL query string: serial=DX91&brand=Dell&model=Latitude+5540&ram=16GB&storage=512GB
    // 2. JSON: {"serial":"DX91","brand":"Dell",...}
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      const params = new URLSearchParams(text);
      for (const [k, v] of params.entries()) data[k] = v;
    }
    onResult(data);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title"><Camera size={16} style={{ marginRight: 8 }} />Scan Laptop Barcode</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#000', aspectRatio: '4/3' }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {/* Scan overlay */}
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.3)'
            }}>
              <div style={{
                width: 200, height: 200, border: '2px solid var(--accent)',
                borderRadius: 12, boxShadow: '0 0 0 2000px rgba(0,0,0,0.4)'
              }} />
            </div>
          </div>
          {error && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 8, fontSize: 13 }}>
              {error}
            </div>
          )}
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 14 }}>
            Point camera at the QR code on the laptop
          </p>
        </div>
      </div>
    </div>
  );
}