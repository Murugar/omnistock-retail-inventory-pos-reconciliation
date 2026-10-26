import React, { useState } from 'react';
import { AppState, inventoryStore } from '../services/inventoryStore';
import { Product, ProductVariant, InventoryBalance } from '../types/inventory';
import { 
  Search, 
  Plus, 
  Filter, 
  SlidersHorizontal, 
  Package, 
  Barcode, 
  Boxes, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  X
} from 'lucide-react';

interface ProductsViewProps {
  state: AppState;
  onOpenReceiptModal: (preselectedSkuId?: string) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({ state, onOpenReceiptModal }) => {
  const { products, balances, categories, locations, selectedLocationId, currentUser } = state;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'healthy'>('all');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(products[0]?.id || null);

  // Manual adjustment modal state
  const [adjustingSku, setAdjustingSku] = useState<{
    variant: ProductVariant;
    balance: InventoryBalance;
    locationName: string;
  } | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('Inventory count correction');
  const [adjustmentMessage, setAdjustmentMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      product.name.toLowerCase().includes(q) ||
      product.brand.toLowerCase().includes(q) ||
      product.variants.some(
        (v) => v.sku.toLowerCase().includes(q) || v.barcode.toLowerCase().includes(q) || v.variantName.toLowerCase().includes(q)
      );

    return matchesCategory && matchesSearch;
  });

  const getSkuBalances = (skuId: string) => {
    if (selectedLocationId === 'all') {
      return balances.filter((b) => b.skuId === skuId);
    }
    return balances.filter((b) => b.skuId === skuId && b.locationId === selectedLocationId);
  };

  const handleExecuteManualAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingSku) return;

    if (currentUser.role === 'store_associate') {
      setAdjustmentMessage({
        type: 'error',
        text: 'Permission denied: Store Associates cannot post manual adjustments directly. Please submit a physical count for manager approval.',
      });
      return;
    }

    const netChange = adjustmentQty - adjustingSku.balance.onHand;
    if (netChange === 0) {
      setAdjustmentMessage({ type: 'error', text: 'New quantity equals current on-hand quantity. No change detected.' });
      return;
    }

    // Direct balance update + transaction + audit
    const prev = adjustingSku.balance.onHand;
    adjustingSku.balance.onHand = adjustmentQty;
    adjustingSku.balance.available = adjustmentQty - adjustingSku.balance.allocated;
    adjustingSku.balance.lastCountedAt = new Date().toISOString();

    const product = products.find((p) => p.id === adjustingSku.variant.productId);

    // Save adjustment transaction
    state.transactions = [
      {
        id: `tx_${Date.now()}`,
        timestamp: new Date().toISOString(),
        skuId: adjustingSku.variant.id,
        sku: adjustingSku.variant.sku,
        productName: product?.name || 'Product',
        variantName: adjustingSku.variant.variantName,
        locationId: adjustingSku.balance.locationId,
        locationName: adjustingSku.locationName,
        type: netChange < 0 ? 'adjustment_shrinkage' : 'adjustment_surplus',
        quantityDelta: netChange,
        balanceBefore: prev,
        balanceAfter: adjustmentQty,
        unitCost: adjustingSku.variant.unitCost,
        totalValuationDelta: netChange * adjustingSku.variant.unitCost,
        referenceType: 'MANUAL_AUDIT',
        referenceId: `ADJ-${Date.now().toString().slice(-6)}`,
        performedBy: currentUser.name,
        userRole: currentUser.role,
        notes: adjustmentReason,
      },
      ...state.transactions,
    ];

    state.auditLogs = [
      {
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'MANUAL_STOCK_ADJUSTMENT',
        entityType: 'BALANCE',
        entityId: adjustingSku.variant.sku,
        details: `Adjusted ${adjustingSku.variant.sku} at ${adjustingSku.locationName} from ${prev} to ${adjustmentQty} (${netChange > 0 ? '+' : ''}${netChange}). Reason: ${adjustmentReason}`,
        ipAddress: '192.168.1.10 (Management Console)',
      },
      ...state.auditLogs,
    ];

    inventoryStore.getState().balances = [...state.balances];
    setAdjustmentMessage({ type: 'success', text: `Stock balance for ${adjustingSku.variant.sku} updated to ${adjustmentQty}.` });

    setTimeout(() => {
      setAdjustingSku(null);
      setAdjustmentMessage(null);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Central Inventory & SKU Catalog
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Master product records, multi-attribute SKU variations, barcodes, and real-time inventory balances
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenReceiptModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Receive Inventory (PO)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by SKU, barcode, product name, or supplier..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        {/* Filter Segmented Controls */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md shrink-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Categories
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  selectedCategory === c.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products Catalog Display */}
      <div className="space-y-4">
        {filteredProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-xs text-slate-500">
            No products matched your search or category filter.
          </div>
        ) : (
          filteredProducts.map((product) => {
            const isExpanded = expandedProductId === product.id;
            const totalProductStock = product.variants.reduce((acc, v) => {
              const bList = getSkuBalances(v.id);
              return acc + bList.reduce((bSum, b) => bSum + b.onHand, 0);
            }, 0);

            return (
              <div
                key={product.id}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden transition-all"
              >
                {/* Product Master Header Row */}
                <div
                  onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Product Photo with Zero-Broken-Image Fallback */}
                    <div className="w-14 h-14 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {product.brand}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500">{product.categoryName}</span>
                      </div>
                      <h2 className="text-base font-bold text-slate-900 truncate">
                        {product.name}
                      </h2>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {product.description}
                      </p>
                    </div>
                  </div>

                  {/* Summary Counts on Header */}
                  <div className="flex items-center gap-6 sm:justify-end shrink-0 text-xs">
                    <div>
                      <div className="text-slate-400">Variations</div>
                      <div className="font-semibold text-slate-900 font-mono tabular-nums">
                        {product.variants.length} SKUs
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Total Units</div>
                      <div className="font-bold text-slate-900 font-mono tabular-nums text-sm">
                        {totalProductStock} units
                      </div>
                    </div>
                    <button
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                    >
                      {isExpanded ? 'Hide SKUs' : 'Inspect SKUs'}
                    </button>
                  </div>
                </div>

                {/* SKU Variants Matrix Table */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50/30">
                    <div className="px-4 py-2 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      SKU Variant Breakdown & Facility Inventory Balances
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-600 bg-white">
                            <th className="py-2.5 px-4 font-semibold">SKU Identifier</th>
                            <th className="py-2.5 px-4 font-semibold">Barcode</th>
                            <th className="py-2.5 px-4 font-semibold">Attributes / Specs</th>
                            <th className="py-2.5 px-4 font-semibold">Supplier</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Cost</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Retail</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Stock On Hand</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {product.variants.map((v) => {
                            const vBalances = getSkuBalances(v.id);
                            const totalOnHand = vBalances.reduce((sum, b) => sum + b.onHand, 0);
                            const primaryBal = vBalances[0];

                            return (
                              <tr key={v.id} className="hover:bg-slate-50/75 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="font-mono font-bold text-slate-900">{v.sku}</div>
                                  <div className="text-[11px] text-slate-500">{v.variantName}</div>
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                                  {v.barcode}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                                    {Object.entries(v.attributes).map(([key, val]) => (
                                      <span key={key}>
                                        <span className="text-slate-400 capitalize">{key}:</span> {val}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-slate-600 text-[11px]">
                                  <div>{v.supplier}</div>
                                  <div className="text-slate-400 font-mono text-[10px]">{v.supplierCode} · {v.leadTimeDays}d lead</div>
                                </td>
                                <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                                  ${v.unitCost.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                                  ${v.unitPrice.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="font-mono font-bold tabular-nums text-slate-900">
                                    {totalOnHand} units
                                  </div>
                                  {vBalances.map((b) => (
                                    <div key={b.id} className="text-[10px] text-slate-500 font-mono">
                                      {b.locationName.split(' ')[0]}: {b.onHand} (min: {b.minThreshold})
                                    </div>
                                  ))}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => onOpenReceiptModal(v.id)}
                                      className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap"
                                      title="Intake stock for this SKU"
                                    >
                                      PO Intake
                                    </button>
                                    {primaryBal && (
                                      <button
                                        onClick={() => {
                                          setAdjustingSku({
                                            variant: v,
                                            balance: primaryBal,
                                            locationName: primaryBal.locationName,
                                          });
                                          setAdjustmentQty(primaryBal.onHand);
                                        }}
                                        className="px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors whitespace-nowrap"
                                        title="Quick manual balance adjustment"
                                      >
                                        Adjust
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Manual Stock Adjustment Modal */}
      {adjustingSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Manual Stock Adjustment
              </h3>
              <button
                onClick={() => setAdjustingSku(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div>
                <span className="font-semibold text-slate-900">{adjustingSku.variant.sku}</span> · {adjustingSku.variant.variantName}
              </div>
              <div className="text-slate-500">
                Facility: {adjustingSku.locationName}
              </div>
            </div>

            {adjustmentMessage && (
              <div
                className={`p-2.5 rounded text-xs ${
                  adjustmentMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {adjustmentMessage.text}
              </div>
            )}

            <form onSubmit={handleExecuteManualAdjustment} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Current On Hand</label>
                  <input
                    type="text"
                    disabled
                    value={adjustingSku.balance.onHand}
                    className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">New Verified On Hand</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={adjustmentQty}
                    onChange={(e) => setAdjustmentQty(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Reason for Adjustment</label>
                <select
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="Inventory count correction">Inventory count correction</option>
                  <option value="Damaged goods write-off">Damaged goods write-off</option>
                  <option value="Supplier packing slip variance">Supplier packing slip variance</option>
                  <option value="Customer return unrecorded">Customer return unrecorded</option>
                  <option value="Display sample quarantine">Display sample quarantine</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingSku(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                >
                  Post Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
