import React from 'react';
import { 
  AppState 
} from '../services/inventoryStore';
import { ActiveTab } from './Header';
import { 
  Package, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  ClipboardCheck, 
  DollarSign, 
  Boxes, 
  ShoppingCart,
  TrendingDown,
  Layers,
  ArrowRight,
  RotateCcw
} from 'lucide-react';

interface DashboardViewProps {
  state: AppState;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenReceiptModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  setActiveTab,
  onOpenReceiptModal,
}) => {
  const { balances, products, transactions, posSales, reconciliationSessions, selectedLocationId, locations } = state;

  // Filter balances based on selected location
  const filteredBalances = selectedLocationId === 'all'
    ? balances
    : balances.filter((b) => b.locationId === selectedLocationId);

  const selectedLocName = selectedLocationId === 'all'
    ? 'All Network Facilities'
    : locations.find((l) => l.id === selectedLocationId)?.name || 'Facility';

  // Key Metrics
  const totalUnits = filteredBalances.reduce((sum, b) => sum + b.onHand, 0);
  const totalCostValuation = filteredBalances.reduce((sum, b) => sum + (b.onHand * b.unitCost), 0);
  const totalRetailValuation = filteredBalances.reduce((sum, b) => sum + (b.onHand * b.unitPrice), 0);
  
  const lowStockItems = filteredBalances.filter((b) => b.onHand <= b.minThreshold && b.onHand > 0);
  const outOfStockItems = filteredBalances.filter((b) => b.onHand === 0);

  // Active SKUs count
  const allSkus = products.flatMap((p) => p.variants);
  const uniqueSkusCount = allSkus.length;

  // POS sales metrics (last 7 days / recorded)
  const totalPosRevenue = posSales.reduce((acc, s) => acc + s.total, 0);
  const totalPosUnits = posSales.reduce((acc, s) => acc + s.items.reduce((iSum, item) => iSum + item.quantity, 0), 0);

  // Reconciliation exceptions & shrinkage
  const pendingReviewSessions = reconciliationSessions.filter((s) => s.status === 'pending_manager_approval');
  const totalShrinkageUnits = reconciliationSessions
    .filter((s) => s.status === 'approved_posted')
    .reduce((acc, s) => acc + Math.abs(s.netVarianceUnits), 0);
  const totalShrinkageCost = reconciliationSessions
    .filter((s) => s.status === 'approved_posted')
    .reduce((acc, s) => acc + Math.abs(s.netVarianceCost), 0);

  // Movement breakdown from recent transactions
  const movementCounts: Record<string, { count: number; units: number }> = {
    receipt: { count: 0, units: 0 },
    pos_sale: { count: 0, units: 0 },
    customer_return: { count: 0, units: 0 },
    transfer_in: { count: 0, units: 0 },
    adjustment_shrinkage: { count: 0, units: 0 },
  };

  transactions.forEach((tx) => {
    if (movementCounts[tx.type]) {
      movementCounts[tx.type].count += 1;
      movementCounts[tx.type].units += Math.abs(tx.quantityDelta);
    }
  });

  return (
    <div className="space-y-6">
      {/* Scope Banner & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Retail Inventory Operations
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span>Scope: {selectedLocName}</span>
            <span aria-hidden="true">·</span>
            <span>Live Central Database</span>
            <span aria-hidden="true">·</span>
            <span>Real-time POS Synchronization</span>
          </div>
        </div>

        {/* Quick Actions Launchpad */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenReceiptModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Receive Intake (PO)</span>
          </button>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors"
          >
            <ClipboardCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Start Physical Count</span>
          </button>
        </div>
      </div>

      {/* 4-KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Inventory Valuation */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Inventory Asset Valuation</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            ${totalCostValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>Retail value: ${totalRetailValuation.toLocaleString()}</span>
            <span className="font-mono tabular-nums text-slate-600">{totalUnits} units</span>
          </div>
        </div>

        {/* KPI 2: Stock Health & Alerts */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Stock Health & Reorder Alerts</span>
            <AlertTriangle className={`w-4 h-4 ${lowStockItems.length > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {lowStockItems.length + outOfStockItems.length}
            <span className="text-xs font-normal text-slate-500 ml-1">items flagged</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span className={lowStockItems.length > 0 ? 'text-amber-600 font-medium' : 'text-slate-500'}>
              {lowStockItems.length} below minimum
            </span>
            <span className={outOfStockItems.length > 0 ? 'text-rose-600 font-medium' : 'text-slate-500'}>
              {outOfStockItems.length} depleted
            </span>
          </div>
        </div>

        {/* KPI 3: POS Ingestion */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>POS Sales Ingestion</span>
            <ShoppingCart className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            ${totalPosRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>{posSales.length} synchronized receipts</span>
            <span className="font-mono tabular-nums text-slate-600">{totalPosUnits} units sold</span>
          </div>
        </div>

        {/* KPI 4: Reconciliation & Shrinkage */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Reconciliation Exceptions</span>
            <TrendingDown className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {pendingReviewSessions.length}
            <span className="text-xs font-normal text-slate-500 ml-1">pending review</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>Historical write-off:</span>
            <span className="font-mono tabular-nums text-rose-600 font-medium">
              -${totalShrinkageCost.toFixed(2)} ({totalShrinkageUnits}u)
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Stock Alerts & Inventory Movement Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Urgent Stock Action Items (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Critical Reorder Section */}
          <div className="bg-white border border-slate-200 rounded-lg">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Critical Stock Reorder Recommendations
                </h2>
                <p className="text-xs text-slate-500">
                  SKUs falling below safety reorder threshold in active facilities
                </p>
              </div>
              <button
                onClick={() => setActiveTab('inventory')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span>Full Catalog</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-4 font-semibold">SKU / Item</th>
                    <th className="py-2.5 px-4 font-semibold">Location</th>
                    <th className="py-2.5 px-4 font-semibold text-right">On Hand</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Min Threshold</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Suggested PO</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        All SKUs are currently stocked above safety thresholds.
                      </td>
                    </tr>
                  ) : (
                    lowStockItems.map((bal) => {
                      const suggestedReorder = bal.maxCapacity - bal.onHand;
                      return (
                        <tr key={bal.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{bal.sku}</div>
                            <div className="text-slate-500 text-[11px] truncate max-w-xs">
                              {bal.productName} · {bal.variantName}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {bal.locationName}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-amber-600 tabular-nums">
                            {bal.onHand}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-500 tabular-nums">
                            {bal.minThreshold}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 tabular-nums">
                            +{suggestedReorder}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={onOpenReceiptModal}
                              className="px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors whitespace-nowrap"
                            >
                              Create PO
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Inventory Movement Ledger Highlights */}
          <div className="bg-white border border-slate-200 rounded-lg">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Live Stock Movement Activity
                </h2>
                <p className="text-xs text-slate-500">
                  Real-time receipts, POS sales, and transfers recorded across locations
                </p>
              </div>
              <button
                onClick={() => setActiveTab('transactions')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span>View Full Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {transactions.slice(0, 5).map((tx) => {
                const isPositive = tx.quantityDelta > 0;
                return (
                  <div key={tx.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                          tx.type === 'receipt'
                            ? 'bg-emerald-50 text-emerald-700'
                            : tx.type === 'pos_sale'
                            ? 'bg-slate-100 text-slate-700'
                            : tx.type === 'customer_return'
                            ? 'bg-blue-50 text-blue-700'
                            : tx.type.startsWith('adjustment')
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-purple-50 text-purple-700'
                        }`}
                      >
                        {tx.type === 'receipt' ? (
                          <ArrowDownRight className="w-4 h-4" />
                        ) : tx.type === 'pos_sale' ? (
                          <ShoppingCart className="w-4 h-4" />
                        ) : tx.type === 'customer_return' ? (
                          <RotateCcw className="w-4 h-4" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {tx.sku} · {tx.variantName}
                        </div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-1.5 truncate">
                          <span>{tx.referenceType}: {tx.referenceId}</span>
                          <span aria-hidden="true">·</span>
                          <span>{tx.locationName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono font-bold tabular-nums ${
                          isPositive ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        {isPositive ? `+${tx.quantityDelta}` : tx.quantityDelta} units
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                        bal: {tx.balanceAfter}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Pending Reconciliation & POS Integration Health */}
        <div className="space-y-6">
          {/* Pending Reconciliation Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Reconciliation Reviews
              </h3>
              <span className="text-xs font-mono font-medium text-amber-600 tabular-nums">
                {pendingReviewSessions.length} Action Needed
              </span>
            </div>

            {pendingReviewSessions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No cycle counts currently awaiting manager sign-off.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {pendingReviewSessions.map((sess) => (
                  <div key={sess.id} className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{sess.sessionCode}</span>
                      <span className="text-[11px] text-amber-700 font-medium">Pending Manager</span>
                    </div>
                    <div className="text-slate-600 text-[11px]">
                      {sess.locationName} · {sess.categoryFilter}
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-amber-200/50">
                      <span className="text-slate-500">Net Variance:</span>
                      <span className="font-mono font-bold text-rose-600 tabular-nums">
                        {sess.netVarianceUnits} units (${sess.netVarianceCost.toFixed(2)})
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('reconciliation')}
                      className="w-full mt-1 py-1.5 text-center text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                    >
                      Review & Authorize Adjustments
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* POS Sync Status Overview */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Point-of-Sale Connectors
              </h3>
              <button
                onClick={() => setActiveTab('pos')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Manage
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {state.posIntegrations.map((pos) => (
                <div key={pos.id} className="flex items-center justify-between text-xs py-1">
                  <div>
                    <div className="font-semibold text-slate-900 capitalize">
                      {pos.provider} POS
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Synced {pos.totalSyncedSales} orders
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-emerald-600">Active</span>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {new Date(pos.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick System Architecture Note */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>MySQL 8.0 Central Architecture</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              All inventory transactions adhere to double-entry ledger invariants. Physical counts trigger atomic adjustments with foreign-key referential integrity and audit stamps.
            </p>
            <button
              onClick={() => setActiveTab('mysql_studio')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-block"
            >
              Explore Database DDL & SQL Studio →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
