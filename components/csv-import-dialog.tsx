'use client';

import { useState } from 'react';
import { db, Product } from '@/lib/db-client';
import { useToast } from '@/hooks/use-toast';
import { parseCSV } from '@/lib/format';
import { Upload, X, FileText, Loader2, Check } from 'lucide-react';

export function CSVImportDialog({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const { toast } = useToast();
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Array<Record<string, string>> | null>(null);

  const sampleCSV = `name,sku,quantity,cost,baseUnitSalePrice,lowStockThreshold,barcode
Paracetamol 500mg,PARA500,100,30,50,10,6001234567890
Vitamin C 1000mg,VITC1K,50,80,150,10,6001234567891
Aspirin 75mg,ASP75,200,25,40,20,6001234567892`;

  const parseInput = () => {
    try {
      const rows = parseCSV(csvText.trim());
      if (rows.length === 0) {
        toast({ type: 'error', title: 'No data', description: 'CSV appears empty' });
        return;
      }
      setPreview(rows.slice(0, 5));
      toast({ type: 'info', title: 'Preview ready', description: `${rows.length} rows detected` });
    } catch (e: unknown) {
      toast({ type: 'error', title: 'Parse failed', description: e instanceof Error ? e.message : '' });
    }
  };

  const importProducts = async () => {
    setImporting(true);
    try {
      const rows = parseCSV(csvText.trim());
      let added = 0;
      let skipped = 0;

      for (const row of rows) {
        const name = row.name?.trim();
        const sku = row.sku?.trim();
        if (!name || !sku) { skipped++; continue; }

        // Check if SKU exists
        const existing = await db.products.where('sku').equals(sku).first();
        if (existing) { skipped++; continue; }

        const product: Omit<Product, 'id'> = {
          name,
          sku,
          storeId: 1,
          barcode: row.barcode?.trim() || undefined,
          quantity: parseInt(row.quantity || '0', 10) || 0,
          cost: parseFloat(row.cost || '0') || 0,
          baseUnitSalePrice: parseFloat(row.baseUnitSalePrice || row.price || '0') || 0,
          lowStockThreshold: parseInt(row.lowStockThreshold || '5', 10) || 5,
          categoryId: undefined,
          updatedAt: Date.now(),
        };
        await db.products.add(product);
        added++;
      }

      toast({
        type: 'success',
        title: 'Import complete',
        description: `${added} product(s) added, ${skipped} skipped (missing data or duplicate SKU)`,
      });
      onComplete();
      onClose();
    } catch (e: unknown) {
      toast({ type: 'error', title: 'Import failed', description: e instanceof Error ? e.message : '' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" /> Import products from CSV
          </h2>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-info/10 border border-info/20 rounded-lg p-3 text-sm">
            <div className="font-semibold text-info mb-1 flex items-center gap-1">
              <FileText className="w-4 h-4" /> CSV format
            </div>
            <div className="text-muted-foreground text-xs">
              Columns: name, sku, quantity, cost, baseUnitSalePrice, lowStockThreshold, barcode
            </div>
            <button
              onClick={() => setCsvText(sampleCSV)}
              className="text-xs text-primary font-semibold mt-2 hover:underline"
            >
              Load sample data
            </button>
          </div>

          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">
              Paste CSV content
            </label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="name,sku,quantity,cost,baseUnitSalePrice,lowStockThreshold,barcode&#10;Paracetamol 500mg,PARA500,100,30,50,10,6001234567890"
              className="input-premium font-mono text-xs"
              rows={8}
            />
          </div>

          {preview && (
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">
                Preview (first 5 rows)
              </label>
              <div className="bg-muted/30 rounded-lg p-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {Object.keys(preview[0]).map((h) => (
                        <th key={h} className="text-left p-1 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="p-1 truncate max-w-[120px]">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border flex gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          {!preview ? (
            <button onClick={parseInput} disabled={!csvText.trim()} className="btn-secondary flex-1">
              Preview
            </button>
          ) : (
            <button
              onClick={importProducts}
              disabled={importing}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : <><Check className="w-4 h-4" /> Import Products</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
