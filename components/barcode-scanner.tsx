'use client';

/**
 * StockPilot — Barcode Scanner Component
 * ------------------------------------------------------------------
 * Uses native ML Kit bridge (Capacitor) or web BarcodeDetector.
 * Modal overlay with full-screen camera preview.
 */

import { useState } from 'react';
import { scanBarcode, requestCameraPermission } from '@/native/barcode-scanner';
import { hapticLight } from '@/native/haptics';

export function BarcodeScanner({ onDetected, onClose }: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const start = async () => {
    setError(null);
    setScanning(true);
    try {
      const granted = await requestCameraPermission();
      if (!granted) { setError('Camera permission denied'); setScanning(false); return; }
      const code = await scanBarcode();
      if (code) {
        await hapticLight();
        onDetected(code);
        onClose();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center text-white">
      <div className="absolute top-4 right-4">
        <button onClick={onClose} className="bg-white/10 px-4 py-2 rounded-lg">✕ Close</button>
      </div>

      <div className="w-64 h-64 border-4 border-primary rounded-2xl relative">
        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary animate-pulse" />
      </div>

      <div className="mt-6 text-center space-y-3">
        <p className="text-sm opacity-80">Point the camera at a barcode</p>
        {error && <p className="text-danger text-sm">{error}</p>}
        <button
          onClick={start}
          disabled={scanning}
          className="bg-primary px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
        >
          {scanning ? 'Scanning...' : 'Start scan'}
        </button>
      </div>
    </div>
  );
}
