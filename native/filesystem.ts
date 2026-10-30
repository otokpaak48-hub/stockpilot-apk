/**
 * StockPilot — Native Filesystem (backups → Downloads folder)
 * On native: uses @capacitor/filesystem.
 * On web: falls back to browser Blob download.
 */
import { isNative } from './index';

const BACKUP_DIR = 'StockPilot';

export async function ensureBackupDir(): Promise<void> {
  if (!isNative()) return;
  const { Filesystem, Directory } = await import(/* webpackIgnore: true */ '@capacitor/filesystem');
  try {
    await Filesystem.mkdir({ path: BACKUP_DIR, directory: Directory.Documents, recursive: true });
  } catch { /* dir exists */ }
}

export async function writeBackupFile(filename: string, content: string): Promise<string> {
  if (!isNative()) {
    downloadBlobWeb(filename, content);
    return filename;
  }
  const { Filesystem, Directory, Encoding } = await import(/* webpackIgnore: true */ '@capacitor/filesystem');
  await ensureBackupDir();
  const result = await Filesystem.writeFile({
    path: `${BACKUP_DIR}/${filename}`,
    data: content,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  return result.uri;
}

export async function readBackupFile(filename: string): Promise<string> {
  if (!isNative()) throw new Error('Filesystem is only available in native build');
  const { Filesystem, Directory, Encoding } = await import(/* webpackIgnore: true */ '@capacitor/filesystem');
  const result = await Filesystem.readFile({
    path: `${BACKUP_DIR}/${filename}`,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
  });
  return typeof result.data === 'string' ? result.data : await blobToText(result.data);
}

export async function listBackups(): Promise<string[]> {
  if (!isNative()) return [];
  const { Filesystem, Directory } = await import(/* webpackIgnore: true */ '@capacitor/filesystem');
  try {
    const result = await Filesystem.readdir({ path: BACKUP_DIR, directory: Directory.Documents });
    return result.files
      .filter((f) => f.name.endsWith('.json') || f.name.endsWith('.spbk'))
      .map((f) => f.name);
  } catch {
    return [];
  }
}

export async function deleteBackup(filename: string): Promise<void> {
  if (!isNative()) return;
  const { Filesystem, Directory } = await import(/* webpackIgnore: true */ '@capacitor/filesystem');
  await Filesystem.deleteFile({ path: `${BACKUP_DIR}/${filename}`, directory: Directory.Documents });
}

function downloadBlobWeb(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function blobToText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}
