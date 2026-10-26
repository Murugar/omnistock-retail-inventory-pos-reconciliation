import React, { useState } from 'react';
import { AppState, inventoryStore } from '../services/inventoryStore';
import { TransactionType } from '../types/inventory';
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  RotateCcw, 
  RefreshCw, 
  Download, 
  Plus, 
  Search, 
  Filter,
  Truck,
  ArrowRightLeft,
  X
} from 'lucide-react';

interface TransactionsViewProps {
  state: AppState;
  onOpenReceiptModal: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ state, onOpenReceiptModal }) => {
  const { transactions, locations, selectedLocationId, products, currentUser } = state;

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // Transfer Form State
  const [transferSkuId, setTransferSkuId] = useState(products[0]?.variants[0]?.id || '');
  const [transferSrcLoc, setTransferSrcLoc] = useState('loc_warehouse');
  const [transferDestLoc, setTransferDestLoc] = useState('loc_flagship');
  const [transferQty, setTransferQty] = useState(5);
  const [transferNotes, setTransferNotes] = useState('Routine store replenishment');
  const [transferFeedback, setTransferFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Return Form State
  const [returnSkuId, setReturnSkuId] = useState(products[0]?.variants[0]?.id || '');
  const [returnLocationId, setReturnLocationId] = useState('loc_flagship');
  const [returnQty, setReturnQty] = useState(1);
  const [returnRma, setReturnRma] = useState(`RMA-${Date.now().toString().slice(-5)}`);
  const [returnReason, setReturnReason] = useState('Customer sized up, undamaged');
  const [returnFeedback, setReturnFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    const matchesLoc = selectedLocationId === 'all' || tx.locationId === selectedLocationId;
    const matchesType = typeFilter === 'all' || tx.type === typeFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      tx.sku.toLowerCase().includes(q) ||
      tx.referenceId.toLowerCase().includes(q) ||
      tx.productName.toLowerCase().includes(q) ||
      tx.performedBy.toLowerCase().includes(q);

    return matchesLoc && matchesType && matchesSearch;
  });

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const res = inventoryStore.recordTransfer({
      skuId: transferSkuId,
      sourceLocationId: transferSrcLoc,
      destinationLocationId: transferDestLoc,
      quantity: transferQty,
      transferOrderNumber: `TRF-${Date.now().toString().slice(-6)}`,
      notes: transferNotes,
    });

    if (res.success) {
      setTransferFeedback({ type: 'success', text: res.message });
      setTimeout(() => {
        setShowTransferModal(false);
        setTransferFeedback(null);
      }, 1200);
    } else {
      setTransferFeedback({ type: 'error', text: res.message });
    }
  };

  const handleExecuteReturn = (e: React.FormEvent) => {
    e.preventDefault();
    const sku = inventoryStore.findSkuById(returnSkuId);
    if (!sku) return;

    const loc = locations.find((l) => l.id === returnLocationId);
    const product = products.find((p) => p.id === sku.productId);
    const balance = inventoryStore.getOrCreateBalance(sku, returnLocationId, product?.name || sku.variantName);

    const prev = balance.onHand;
    const newQty = prev + returnQty;
    balance.onHand = newQty;
    balance.available = newQty - balance.allocated;

    state.transactions = [
      {
        id: `tx_${Date.now()}`,
        timestamp: new Date().toISOString(),
        skuId: sku.id,
        sku: sku.sku,
        productName: product?.name || 'Product',
        variantName: sku.variantName,
        locationId: returnLocationId,
        locationName: loc?.name || 'Store',
        type: 'customer_return',
        quantityDelta: returnQty,
        balanceBefore: prev,
        balanceAfter: newQty,
        unitCost: sku.unitCost,
        totalValuationDelta: returnQty * sku.unitCost,
        referenceType: 'RETURN_AUTH',
        referenceId: returnRma,
        performedBy: currentUser.name,
        userRole: currentUser.role,
        notes: `Customer return restocked: ${returnReason}`,
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
        action: 'CUSTOMER_RETURN_PROCESSED',
        entityType: 'TRANSACTION',
        entityId: returnRma,
        details: `Restocked ${returnQty} units of ${sku.sku} at ${loc?.name}. RMA: ${returnRma}. Reason: ${returnReason}`,
        ipAddress: '192.168.1.10 (Returns Counter)',
      },
      ...state.auditLogs,
    ];

    setReturnFeedback({ type: 'success', text: `Restocked ${returnQty} units of ${sku.sku}.` });
    setTimeout(() => {
      setShowReturnModal(false);
      setReturnFeedback(null);
    }, 1200);
  };

  const exportTransactionsCsv = () => {
    const headers = ['Timestamp', 'Transaction_ID', 'Type', 'SKU', 'Product', 'Variant', 'Location', 'Delta', 'Balance_After', 'Unit_Cost', 'Valuation_Delta', 'Reference_Type', 'Reference_ID', 'Actor'];
    const rows = filteredTransactions.map((tx) => [
      tx.timestamp,
      tx.id,
      tx.type,
      tx.sku,
      `"${tx.productName.replace(/"/g, '""')}"`,
      `"${tx.variantName.replace(/"/g, '""')}"`,
      `"${tx.locationName}"`,
      tx.quantityDelta,
      tx.balanceAfter,
      tx.unitCost.toFixed(2),
      tx.totalValuationDelta.toFixed(2),
      tx.referenceType,
      tx.referenceId,
      `"${tx.performedBy}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `omnistock_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const allVariants = products.flatMap((p) => p.variants);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Inventory Movements & Transaction Ledger
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Immutable double-entry transaction history tracking receipts, sales, transfers, returns, and adjustments
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
            <span>Store Transfer</span>
          </button>
          <button
            onClick={() => setShowReturnModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Process Return</span>
          </button>
          <button
            onClick={onOpenReceiptModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Receive PO</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by SKU, reference PO/Receipt ID, product, or actor..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md shrink-0">
            {[
              { id: 'all', label: 'All Transactions' },
              { id: 'receipt', label: 'Receipts' },
              { id: 'pos_sale', label: 'POS Sales' },
              { id: 'transfer_in', label: 'Transfers' },
              { id: 'customer_return', label: 'Returns' },
              { id: 'adjustment_shrinkage', label: 'Adjustments' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTypeFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  typeFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={exportTransactionsCsv}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md shrink-0 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                <th className="py-2.5 px-4 font-semibold">Type</th>
                <th className="py-2.5 px-4 font-semibold">SKU & Product</th>
                <th className="py-2.5 px-4 font-semibold">Location</th>
                <th className="py-2.5 px-4 font-semibold text-right">Delta</th>
                <th className="py-2.5 px-4 font-semibold text-right">Balance</th>
                <th className="py-2.5 px-4 font-semibold text-right">Unit Cost</th>
                <th className="py-2.5 px-4 font-semibold text-right">Valuation Δ</th>
                <th className="py-2.5 px-4 font-semibold">Reference</th>
                <th className="py-2.5 px-4 font-semibold">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No transactions match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isPositive = tx.quantityDelta > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(tx.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold text-[11px] ${
                            tx.type === 'receipt'
                              ? 'text-emerald-700'
                              : tx.type === 'pos_sale'
                              ? 'text-slate-800'
                              : tx.type === 'customer_return'
                              ? 'text-blue-700'
                              : tx.type.startsWith('adjustment')
                              ? 'text-amber-700'
                              : 'text-purple-700'
                          }`}
                        >
                          {tx.type.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-900">{tx.sku}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {tx.variantName}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {tx.locationName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                        <span className={isPositive ? 'text-emerald-600' : 'text-slate-900'}>
                          {isPositive ? `+${tx.quantityDelta}` : tx.quantityDelta}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        {tx.balanceBefore} → <span className="font-semibold text-slate-800">{tx.balanceAfter}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        ${tx.unitCost.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className={tx.totalValuationDelta >= 0 ? 'text-emerald-600' : 'text-slate-700'}>
                          {tx.totalValuationDelta >= 0 ? '+' : ''}${tx.totalValuationDelta.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        <span className="text-slate-400">{tx.referenceType}: </span>
                        {tx.referenceId}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px] whitespace-nowrap">
                        {tx.performedBy}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inter-Store Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-500" />
                <span>Inter-Store Inventory Transfer</span>
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {transferFeedback && (
              <div
                className={`p-2.5 rounded text-xs ${
                  transferFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {transferFeedback.text}
              </div>
            )}

            <form onSubmit={handleExecuteTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Select SKU to Transfer</label>
                <select
                  value={transferSkuId}
                  onChange={(e) => setTransferSkuId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {allVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.sku} - {v.variantName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Source Location</label>
                  <select
                    value={transferSrcLoc}
                    onChange={(e) => setTransferSrcLoc(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Destination Location</label>
                  <select
                    value={transferDestLoc}
                    onChange={(e) => setTransferDestLoc(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Transfer Quantity (Units)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferQty}
                  onChange={(e) => setTransferQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Transfer Notes / Order Ref</label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                >
                  Dispatch Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>Customer Return & Restock</span>
              </h3>
              <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {returnFeedback && (
              <div
                className={`p-2.5 rounded text-xs ${
                  returnFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {returnFeedback.text}
              </div>
            )}

            <form onSubmit={handleExecuteReturn} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Returned SKU</label>
                <select
                  value={returnSkuId}
                  onChange={(e) => setReturnSkuId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {allVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.sku} - {v.variantName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Return Destination Facility</label>
                  <select
                    value={returnLocationId}
                    onChange={(e) => setReturnLocationId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Quantity Returned</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={returnQty}
                    onChange={(e) => setReturnQty(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">RMA Reference Number</label>
                <input
                  type="text"
                  required
                  value={returnRma}
                  onChange={(e) => setReturnRma(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Condition & Return Reason</label>
                <input
                  type="text"
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                >
                  Process & Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
