/**
 * StockPilot — Native Barcode Scanner (ML Kit)
 * ------------------------------------------------------------------
 * On native Android: uses @capacitor-mlkit/barcode-scanning (loaded dynamically).
 * On web: returns null (use the existing PWA BarcodeDetector component).
 */

import { isNative } from './index';

export async function requestCameraPermission(): Promise<boolean> {
  if (!isNative()) return true;
  const { BarcodeScanner } = await import(/* webpackIgnore: true */ '@capacitor-mlkit/barcode-scanning');
  const { camera } = await BarcodeScanner.checkPermissions();
  if (camera === 'granted') return true;
  const { camera: after } = await BarcodeScanner.requestPermissions();
  return after === 'granted';
}

export async function scanBarcode(): Promise<string | null> {
  if (!isNative()) return scanBarcodeWeb();

  const { BarcodeScanner, SupportedFormat } = await import(/* webpackIgnore: true */ '@capacitor-mlkit/barcode-scanning');
  const granted = await requestCameraPermission();
  if (!granted) throw new Error('Camera permission denied');

  await BarcodeScanner.startScan({
    formats: [SupportedFormat.Ean13, SupportedFormat.Ean8, SupportedFormat.Upca, SupportedFormat.QrCode, SupportedFormat.Code128],
  });

  return new Promise((resolve) => {
    BarcodeScanner.addListener('barcodesScanned', async (result) => {
      await BarcodeScanner.stopScan();
      resolve(result.barcodes[0]?.rawValue ?? null);
    });
    setTimeout(async () => {
      await BarcodeScanner.stopScan();
      resolve(null);
    }, 60_000);
  });
}

async function scanBarcodeWeb(): Promise<string | null> {
  if (!('BarcodeDetector' in window)) {
    alert('Barcode scanning requires the Android app (ML Kit). On web, you can type the barcode manually.');
    return null;
  }
  return null;
}
