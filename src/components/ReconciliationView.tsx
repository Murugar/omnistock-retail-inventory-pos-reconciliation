import React, { useState } from 'react';
import { AppState, inventoryStore } from '../services/inventoryStore';
import { 
  ReconciliationSession, 
  ReconciliationItem, 
  DiscrepancyReason 
} from '../types/inventory';
import { 
  ClipboardCheck, 
  Barcode, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown, 
  ShieldAlert, 
  FileCheck, 
  Search, 
  Plus, 
  Sparkles,
  ArrowRight,
  RotateCcw,
  UserCheck,
  Check,
  X
} from 'lucide-react';

interface ReconciliationViewProps {
  state: AppState;
}

export const ReconciliationView: React.FC<ReconciliationViewProps> = ({ state }) => {
  const { reconciliationSessions, locations, categories, currentUser } = state;

  const [activeSessionId, setActiveSessionId] = useState<string>(
    reconciliationSessions[0]?.id || ''
  );
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [newLocationId, setNewLocationId] = useState('loc_flagship');
  const [newCategoryFilter, setNewCategoryFilter] = useState('all');

  // Scanner Simulator
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanMessage, setScanMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Manager Review State
  const [managerNotes, setManagerNotes] = useState('Reviewed variance details. Discrepancies verified against fitting room security tags and damaged stock logs. Authorized.');
  const [reviewResult, setReviewResult] = useState<{ success: boolean; message: string } | null>(null);

  const activeSession = reconciliationSessions.find((s) => s.id === activeSessionId) || reconciliationSessions[0];

  const handleStartNewSession = (e: React.FormEvent) => {
    e.preventDefault();
    const newSession = inventoryStore.startReconciliationSession({
      locationId: newLocationId,
      categoryFilter: newCategoryFilter,
    });
    setActiveSessionId(newSession.id);
    setShowNewSessionModal(false);
  };

  const handleCountChange = (skuId: string, countStr: string) => {
    if (!activeSession) return;
    const count = countStr === '' ? 0 : parseInt(countStr, 10);
    inventoryStore.updatePhysicalCount({
      sessionId: activeSession.id,
      skuId,
      physicalCount: isNaN(count) ? 0 : count,
    });
  };

  const handleReasonChange = (skuId: string, reason: DiscrepancyReason) => {
    if (!activeSession) return;
    const item = activeSession.items.find((i) => i.skuId === skuId);
    if (!item) return;
    inventoryStore.updatePhysicalCount({
      sessionId: activeSession.id,
      skuId,
      physicalCount: item.physicalCount ?? item.expectedOnHand,
      reasonCode: reason,
    });
  };

  const handleItemNotesChange = (skuId: string, notes: string) => {
    if (!activeSession) return;
    const item = activeSession.items.find((i) => i.skuId === skuId);
    if (!item) return;
    inventoryStore.updatePhysicalCount({
      sessionId: activeSession.id,
      skuId,
      physicalCount: item.physicalCount ?? item.expectedOnHand,
      counterNotes: notes,
    });
  };

  const handleScanBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim() || !activeSession) return;

    const code = barcodeInput.trim();
    const item = activeSession.items.find(
      (i) => i.barcode === code || i.sku.toLowerCase() === code.toLowerCase()
    );

    if (item) {
      const current = item.physicalCount ?? 0;
      const nextCount = current + 1;
      inventoryStore.updatePhysicalCount({
        sessionId: activeSession.id,
        skuId: item.skuId,
        physicalCount: nextCount,
      });
      setScanMessage({ text: `Scanned ${item.sku} (+1)! Physical count is now ${nextCount}.` });
      setBarcodeInput('');
    } else {
      setScanMessage({ text: `Barcode/SKU "${code}" not found in this cycle count scope.`, isError: true });
    }

    setTimeout(() => setScanMessage(null), 3000);
  };

  const handleFillAllExpected = () => {
    if (!activeSession) return;
    activeSession.items.forEach((item) => {
      inventoryStore.updatePhysicalCount({
        sessionId: activeSession.id,
        skuId: item.skuId,
        physicalCount: item.expectedOnHand,
      });
    });
  };

  const handleSubmitForReview = () => {
    if (!activeSession) return;
    const res = inventoryStore.submitSessionForManagerReview(activeSession.id);
    if (res.success) {
      setReviewResult({ success: true, message: res.message });
    } else {
      setReviewResult({ success: false, message: res.message });
    }
    setTimeout(() => setReviewResult(null), 4000);
  };

  const handleApproveAndFinalize = () => {
    if (!activeSession) return;
    const res = inventoryStore.approveAndFinalizeReconciliation({
      sessionId: activeSession.id,
      managerNotes,
    });
    setReviewResult({ success: res.success, message: res.message });
    setTimeout(() => setReviewResult(null), 4000);
  };

  const canApprove = currentUser.role !== 'store_associate';
  const discrepancyItems = activeSession ? activeSession.items.filter((i) => i.varianceUnits !== 0 && i.physicalCount !== null) : [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Physical Count & Inventory Reconciliation
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Automated comparison of expected inventory balances against physical counts, variance classification, and management adjustment sign-off
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowNewSessionModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Count Session</span>
          </button>
        </div>
      </div>

      {/* Sessions Selector Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Active Sessions:</span>
        {reconciliationSessions.map((sess) => {
          const isActive = sess.id === activeSession?.id;
          return (
            <button
              key={sess.id}
              onClick={() => setActiveSessionId(sess.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap flex items-center gap-2 ${
                isActive
                  ? 'bg-white border-slate-900 text-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="font-mono font-bold">{sess.sessionCode}</span>
              <span className="text-[11px] text-slate-400">· {sess.locationName.split(' ')[0]}</span>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                  sess.status === 'approved_posted'
                    ? 'bg-emerald-100 text-emerald-800'
                    : sess.status === 'pending_manager_approval'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {sess.status === 'approved_posted'
                  ? 'POSTED'
                  : sess.status === 'pending_manager_approval'
                  ? 'PENDING'
                  : 'COUNTING'}
              </span>
            </button>
          );
        })}
      </div>

      {activeSession ? (
        <div className="space-y-6">
          {/* Active Session Overview Banner */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 font-mono">
                    {activeSession.sessionCode}
                  </h2>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      activeSession.status === 'approved_posted'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : activeSession.status === 'pending_manager_approval'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {activeSession.status === 'approved_posted'
                      ? 'Approved & Adjustments Posted'
                      : activeSession.status === 'pending_manager_approval'
                      ? 'Awaiting Store Manager Approval'
                      : 'Physical Count In Progress'}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500 flex items-center gap-2">
                  <span>Facility: {activeSession.locationName}</span>
                  <span aria-hidden="true">·</span>
                  <span>Scope: {activeSession.categoryFilter || 'All Inventory'}</span>
                  <span aria-hidden="true">·</span>
                  <span>Initiated by: {activeSession.startedBy}</span>
                </div>
              </div>

              {/* Status Action Button */}
              <div className="flex items-center gap-2">
                {activeSession.status === 'in_progress' && (
                  <button
                    onClick={handleSubmitForReview}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
                  >
                    Submit Count for Manager Review
                  </button>
                )}
                {activeSession.status === 'pending_manager_approval' && (
                  <div className="text-xs text-amber-700 font-medium bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
                    Awaiting manager review below
                  </div>
                )}
                {activeSession.status === 'approved_posted' && (
                  <div className="text-xs text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded border border-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Adjustments posted to general ledger by {activeSession.finalizedBy}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Reconciliation KPI Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
              <div>
                <div className="text-xs text-slate-400">Expected Total Units</div>
                <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                  {activeSession.totalExpectedUnits}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Verified Physical Units</div>
                <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                  {activeSession.totalCountedUnits}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Net Variance (Units)</div>
                <div
                  className={`text-xl font-bold font-mono tabular-nums ${
                    activeSession.netVarianceUnits < 0
                      ? 'text-rose-600'
                      : activeSession.netVarianceUnits > 0
                      ? 'text-blue-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {activeSession.netVarianceUnits > 0 ? `+${activeSession.netVarianceUnits}` : activeSession.netVarianceUnits}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Net Valuation Impact ($)</div>
                <div
                  className={`text-xl font-bold font-mono tabular-nums ${
                    activeSession.netVarianceCost < 0
                      ? 'text-rose-600'
                      : activeSession.netVarianceCost > 0
                      ? 'text-blue-600'
                      : 'text-emerald-600'
                  }`}
                >
                  ${activeSession.netVarianceCost.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Feedback Message */}
          {reviewResult && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold ${
                reviewResult.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {reviewResult.message}
            </div>
          )}

          {/* Barcode Scanner & Rapid Count Tool */}
          {activeSession.status === 'in_progress' && (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <form onSubmit={handleScanBarcode} className="flex-1 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="Scan Barcode (e.g. 084920194821) or type SKU to increment count..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                  >
                    Scan (+1)
                  </button>
                </form>

                <button
                  type="button"
                  onClick={handleFillAllExpected}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap"
                  title="Populates all physical counts with current expected balances for quick baseline verification"
                >
                  Auto-fill Expected Baseline
                </button>
              </div>

              {scanMessage && (
                <div
                  className={`mt-2 text-xs font-medium ${
                    scanMessage.isError ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {scanMessage.text}
                </div>
              )}
            </div>
          )}

          {/* Physical Count Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Physical Count Verification Sheet
                </h3>
                <p className="text-xs text-slate-500">
                  Input actual shelf counts to compute variance and tag discrepancy root causes
                </p>
              </div>
              <div className="text-xs text-slate-500">
                {activeSession.items.filter((i) => i.physicalCount !== null).length} of {activeSession.items.length} SKUs counted
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-4 font-semibold">SKU / Item</th>
                    <th className="py-2.5 px-4 font-semibold">Barcode</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Expected</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Physical Count</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Variance Units</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Cost Impact</th>
                    <th className="py-2.5 px-4 font-semibold">Root Cause Classification</th>
                    <th className="py-2.5 px-4 font-semibold">Counter Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeSession.items.map((item) => {
                    const isCounted = item.physicalCount !== null;
                    const isDiscrepant = item.varianceUnits !== 0;

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          !isCounted
                            ? 'bg-white'
                            : isDiscrepant
                            ? 'bg-rose-50/30'
                            : 'bg-emerald-50/20'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900">{item.sku}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">
                            {item.productName} · {item.variantName}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                          {item.barcode}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-600">
                          {item.expectedOnHand}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {activeSession.status === 'in_progress' ? (
                            <input
                              type="number"
                              min="0"
                              placeholder="Count"
                              value={item.physicalCount !== null ? item.physicalCount : ''}
                              onChange={(e) => handleCountChange(item.skuId, e.target.value)}
                              className="w-20 px-2 py-1 text-right font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                          ) : (
                            <span className="font-mono font-bold text-slate-900">
                              {item.physicalCount ?? '-'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                          {!isCounted ? (
                            <span className="text-slate-400">-</span>
                          ) : item.varianceUnits === 0 ? (
                            <span className="text-emerald-600">0</span>
                          ) : (
                            <span className={item.varianceUnits < 0 ? 'text-rose-600' : 'text-blue-600'}>
                              {item.varianceUnits > 0 ? `+${item.varianceUnits}` : item.varianceUnits}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {!isCounted ? (
                            <span className="text-slate-400">-</span>
                          ) : (
                            <span className={item.varianceCost < 0 ? 'text-rose-600' : 'text-slate-700'}>
                              ${item.varianceCost.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isDiscrepant ? (
                            activeSession.status !== 'approved_posted' ? (
                              <select
                                value={item.reasonCode}
                                onChange={(e) => handleReasonChange(item.skuId, e.target.value as DiscrepancyReason)}
                                className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-800 text-[11px] focus:outline-none focus:ring-1 focus:ring-slate-900"
                              >
                                <option value="theft_shoplifting">Theft / Shoplifting</option>
                                <option value="damaged_spoilage">Damaged / Spoilage</option>
                                <option value="pos_misscan">POS Misscan at Register</option>
                                <option value="vendor_shortage">Vendor Shipment Shortage</option>
                                <option value="unrecorded_return">Customer Return Not Logged</option>
                                <option value="clerical_count_error">Clerical / Miscount Correction</option>
                                <option value="unresolved">Unresolved Investigation</option>
                              </select>
                            ) : (
                              <span className="font-medium text-slate-800 text-[11px] capitalize">
                                {item.reasonCode.replace(/_/g, ' ')}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 text-[11px]">Exact Match</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {activeSession.status !== 'approved_posted' ? (
                            <input
                              type="text"
                              value={item.counterNotes}
                              onChange={(e) => handleItemNotesChange(item.skuId, e.target.value)}
                              placeholder="Notes..."
                              className="w-full px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none"
                            />
                          ) : (
                            <span className="text-slate-600 text-[11px]">{item.counterNotes || '-'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Discrepancy Exception Report & Management Sign-Off Section */}
          {discrepancyItems.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Discrepancy Exception Report</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Formal exception audit summary of inventory variances requiring managerial sign-off
                  </p>
                </div>
                <div className="text-right text-xs">
                  <div className="font-bold text-rose-600 font-mono tabular-nums">
                    {activeSession.netVarianceUnits} units / ${activeSession.netVarianceCost.toFixed(2)}
                  </div>
                  <div className="text-slate-400">Total Valuation Write-Off</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-slate-500">Discrepant SKUs</div>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                    {discrepancyItems.length} items
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-slate-500">Net Variance Rate</div>
                  <div className="text-lg font-bold text-rose-600 font-mono mt-0.5">
                    {activeSession.varianceRatePercent}%
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-slate-500">Primary Root Cause</div>
                  <div className="text-sm font-bold text-slate-900 mt-1 capitalize">
                    {discrepancyItems[0]?.reasonCode.replace(/_/g, ' ') || 'Various'}
                  </div>
                </div>
              </div>

              {/* Management Review & Authorization Panel */}
              {activeSession.status === 'pending_manager_approval' && (
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                      <span>Manager Review & Adjustment Authorization</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Active Role: <span className="font-semibold text-slate-900 capitalize">{currentUser.role.replace(/_/g, ' ')}</span>
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium text-xs mb-1">
                      Manager Sign-Off Findings & Authorization Notes
                    </label>
                    <textarea
                      rows={3}
                      value={managerNotes}
                      onChange={(e) => setManagerNotes(e.target.value)}
                      className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-[11px] text-slate-500">
                      {canApprove ? (
                        <span>You are authorized to finalize this inventory reconciliation.</span>
                      ) : (
                        <span className="text-amber-700 font-medium">
                          Store Associates cannot authorize write-offs. Use the header profile switcher to select Store Manager or Operations Director.
                        </span>
                      )}
                    </div>

                    <button
                      onClick={handleApproveAndFinalize}
                      disabled={!canApprove}
                      className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded transition-colors whitespace-nowrap"
                    >
                      Authorize & Post Adjustments
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-xs text-slate-500">
          No active count sessions found. Click "New Count Session" to initiate a cycle count.
        </div>
      )}

      {/* New Session Creation Modal */}
      {showNewSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Initiate Physical Cycle Count
              </h3>
              <button onClick={() => setShowNewSessionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartNewSession} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Target Facility</label>
                <select
                  value={newLocationId}
                  onChange={(e) => setNewLocationId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Category Scope</label>
                <select
                  value={newCategoryFilter}
                  onChange={(e) => setNewCategoryFilter(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="all">All Inventory (Full Store Wall-to-Wall)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Starting a count session snapshots current expected on-hand quantities for every SKU in this facility. Physical counts can be scanned or entered manually.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSessionModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                >
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
