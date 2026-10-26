import React, { useState, useEffect } from 'react';
import { AppState, inventoryStore } from '../services/inventoryStore';
import { ArrowDownRight, Package, X } from 'lucide-react';

interface PurchaseOrderReceiptModalProps {
  state: AppState;
  preselectedSkuId?: string;
  onClose: () => void;
}

export const PurchaseOrderReceiptModal: React.FC<PurchaseOrderReceiptModalProps> = ({
  state,
  preselectedSkuId,
  onClose,
}) => {
  const { products, locations, selectedLocationId } = state;
  const allVariants = products.flatMap((p) => p.variants);

  const [skuId, setSkuId] = useState(preselectedSkuId || allVariants[0]?.id || '');
  const [locationId, setLocationId] = useState(
    selectedLocationId !== 'all' ? selectedLocationId : 'loc_flagship'
  );
  const [quantity, setQuantity] = useState(25);
  const [unitCost, setUnitCost] = useState(48.0);
  const [supplier, setSupplier] = useState('Nordic Knit Mills');
  const [poNumber, setPoNumber] = useState(`PO-2026-${Math.floor(Math.random() * 9000 + 1000)}`);
  const [notes, setNotes] = useState('Standard seasonal inventory replenishment');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const selectedVariant = allVariants.find((v) => v.id === skuId);
    if (selectedVariant) {
      setUnitCost(selectedVariant.unitCost);
      setSupplier(selectedVariant.supplier);
    }
  }, [skuId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = inventoryStore.recordReceipt({
      skuId,
      locationId,
      quantity,
      unitCost,
      supplier,
      poNumber,
      notes,
    });

    if (res.success) {
      setFeedback({ type: 'success', text: res.message });
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ArrowDownRight className="w-5 h-5 text-emerald-600" />
            <span>Receive Inventory (Purchase Order Intake)</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded text-xs font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Select SKU Variant
            </label>
            <select
              value={skuId}
              onChange={(e) => setSkuId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
            >
              {allVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.sku} - {v.variantName} (${v.unitCost.toFixed(2)} cost)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Receiving Facility / Store
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Units Received
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Unit Acquisition Cost ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                PO / Packing Slip #
              </label>
              <input
                type="text"
                required
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Supplier / Manufacturer
            </label>
            <input
              type="text"
              required
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Receiving Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Delivered via Freight Bay #2, cartons inspected intact"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="text-slate-500 font-mono text-xs">
              Valuation impact: <span className="font-bold text-slate-900">+${(quantity * unitCost).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
              >
                Intake Stock & Post Ledger
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
