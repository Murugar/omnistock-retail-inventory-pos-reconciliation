import React, { useState } from 'react';
import { AppState, inventoryStore } from '../services/inventoryStore';
import { PosIntegration, PosProvider } from '../types/inventory';
import { 
  ShoppingCart, 
  UploadCloud, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Terminal, 
  DollarSign, 
  RefreshCw,
  Copy,
  Check,
  Building2,
  X
} from 'lucide-react';

interface PosIntegrationViewProps {
  state: AppState;
}

export const PosIntegrationView: React.FC<PosIntegrationViewProps> = ({ state }) => {
  const { posIntegrations, posSales, locations, products, currentUser } = state;

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'simulator' | 'csv_import' | 'sales_log'>('overview');

  // Simulator State
  const [simProvider, setSimProvider] = useState<PosProvider>('square');
  const [simLocationId, setSimLocationId] = useState('loc_flagship');
  const [simSku, setSimSku] = useState(products[0]?.variants[0]?.sku || 'AW-SWTR-GRN-M');
  const [simQty, setSimQty] = useState(1);
  const [simPaymentMethod, setSimPaymentMethod] = useState<'card' | 'cash' | 'contactless'>('card');
  const [simFeedback, setSimFeedback] = useState<{ type: 'success' | 'warning'; text: string } | null>(null);

  // CSV Import State
  const [csvContent, setCsvContent] = useState('');
  const [csvProvider, setCsvProvider] = useState<PosProvider>('square');
  const [csvLocationId, setCsvLocationId] = useState('loc_flagship');
  const [csvResult, setCsvResult] = useState<{ totalRows: number; imported: number; errors: string[] } | null>(null);

  // Copy helper
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);

  const handleCopyWebhook = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedWebhook(id);
    setTimeout(() => setCopiedWebhook(null), 2000);
  };

  const handleDispatchSimulator = (e: React.FormEvent) => {
    e.preventDefault();
    const skuObj = inventoryStore.findSkuByCode(simSku);
    const unitPrice = skuObj ? skuObj.unitPrice : 85.0;

    const res = inventoryStore.ingestPosSale({
      provider: simProvider,
      locationId: simLocationId,
      items: [{ sku: simSku, quantity: simQty, unitPrice }],
      cashierName: currentUser.name,
      paymentMethod: simPaymentMethod,
    });

    if (res.discrepancies.length > 0) {
      setSimFeedback({
        type: 'warning',
        text: `Sale recorded (${res.orderId}), but discrepancy flagged: ${res.discrepancies.join('; ')}`,
      });
    } else {
      setSimFeedback({
        type: 'success',
        text: `Sale #${res.orderId} processed! Inventory decremented by ${simQty} units in real-time.`,
      });
    }

    setTimeout(() => setSimFeedback(null), 3500);
  };

  const loadSampleCsv = () => {
    const sample = `OrderId,POS_Provider,SKU,Quantity,UnitPrice,Cashier
POS-SQ-10901,Square,AW-SWTR-GRN-M,2,135.00,Tariq M.
POS-SQ-10902,Square,VC-BOOT-BRN-105,1,285.00,Elena R.
POS-SQ-10903,Square,NA-HP90-BLK,1,320.00,Tariq M.
POS-SQ-10904,Square,OO-DRIP-OWH,3,65.00,Tariq M.
POS-SQ-10905,Square,NON-EXISTENT-SKU,1,99.00,Self-Checkout`;
    setCsvContent(sample);
  };

  const handleExecuteCsvImport = () => {
    if (!csvContent.trim()) return;
    const res = inventoryStore.importPosCsv(csvContent, csvLocationId, csvProvider);
    setCsvResult(res);
  };

  const allVariants = products.flatMap((p) => p.variants);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Retail Point-of-Sale (POS) Integrations
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Synchronize sales transactions from Square, Shopify, Lightspeed, and Clover with automatic inventory deduction
          </p>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md shrink-0">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              activeSubTab === 'overview'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Connectors
          </button>
          <button
            onClick={() => setActiveSubTab('simulator')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              activeSubTab === 'simulator'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live Webhook Simulator
          </button>
          <button
            onClick={() => setActiveSubTab('csv_import')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              activeSubTab === 'csv_import'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            CSV Sales Batch Import
          </button>
          <button
            onClick={() => setActiveSubTab('sales_log')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
              activeSubTab === 'sales_log'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Synced Sales Log ({posSales.length})
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: OVERVIEW & ACTIVE CONNECTORS */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {posIntegrations.map((pos) => {
              const loc = locations.find((l) => l.id === pos.locationId);
              return (
                <div
                  key={pos.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 capitalize text-sm">
                      {pos.name}
                    </span>
                    <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connected
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1">
                    <div>
                      Facility: <span className="text-slate-800 font-medium">{loc?.name}</span>
                    </div>
                    <div>
                      API Key: <span className="font-mono text-slate-600">{pos.apiKeyMasked}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-slate-400">Synced Sales</div>
                      <div className="font-bold text-slate-900 font-mono tabular-nums">
                        {pos.totalSyncedSales} orders
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-400">Total Volume</div>
                      <div className="font-bold text-slate-900 font-mono tabular-nums">
                        ${pos.totalSalesVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Webhook Endpoint Box */}
                  <div className="pt-2">
                    <div className="text-[10px] text-slate-400 font-medium mb-1">
                      Live Webhook Ingestion URL
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] font-mono text-slate-600">
                      <span className="truncate">{pos.webhookEndpoint}</span>
                      <button
                        onClick={() => handleCopyWebhook(pos.webhookEndpoint, pos.id)}
                        className="ml-2 text-slate-400 hover:text-slate-600 shrink-0"
                        title="Copy webhook URL"
                      >
                        {copiedWebhook === pos.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Integration Capabilities Explanation */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 text-xs text-slate-600 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Retail POS Data Exchange & Reconciliation Capabilities
            </h3>
            <p className="leading-relaxed">
              OmniStock connects directly to in-store POS register hardware (Square Terminal, Shopify POS, Lightspeed R-Series) via authenticated REST webhooks and scheduled CSV end-of-day register batch settlement.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="font-semibold text-slate-900 mb-1">Real-Time Deduction</div>
                <p className="text-[11px] text-slate-500">
                  Each scanned register line item issues an atomic stock decrement in the inventory ledger with balance audit verification.
                </p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="font-semibold text-slate-900 mb-1">Offline & Discrepancy Safe</div>
                <p className="text-[11px] text-slate-500">
                  Detects unlisted SKUs, negative balance breaches, or mis-scans and flags them for manager review during physical count cycles.
                </p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="font-semibold text-slate-900 mb-1">Audit Trail Anchored</div>
                <p className="text-[11px] text-slate-500">
                  Every POS receipt records the cashier identity, terminal ID, payment method, unit selling price, and tax breakdown.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: LIVE WEBHOOK SIMULATOR */}
      {activeSubTab === 'simulator' && (
        <div className="max-w-2xl bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>POS Sales Ingestion Simulator</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulate an instant customer checkout event at a register to observe live inventory ledger updates
            </p>
          </div>

          {simFeedback && (
            <div
              className={`p-3 rounded-md text-xs font-medium ${
                simFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {simFeedback.text}
            </div>
          )}

          <form onSubmit={handleDispatchSimulator} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">POS Gateway</label>
                <select
                  value={simProvider}
                  onChange={(e) => setSimProvider(e.target.value as PosProvider)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="square">Square Register (Flagship)</option>
                  <option value="shopify">Shopify POS (E-Commerce)</option>
                  <option value="lightspeed">Lightspeed POS (Boutique)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Store Facility</label>
                <select
                  value={simLocationId}
                  onChange={(e) => setSimLocationId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">Product SKU to Sell</label>
                <select
                  value={simSku}
                  onChange={(e) => setSimSku(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {allVariants.map((v) => (
                    <option key={v.id} value={v.sku}>
                      {v.sku} - {v.variantName} (${v.unitPrice.toFixed(2)})
                    </option>
                  ))}
                  <option value="SKU-UNKNOWN-999">SKU-UNKNOWN-999 (Test Discrepancy)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Units Sold</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={simQty}
                  onChange={(e) => setSimQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Payment Method</label>
              <div className="flex items-center gap-2">
                {(['card', 'contactless', 'cash'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSimPaymentMethod(method)}
                    className={`px-3 py-1.5 rounded border capitalize transition-colors ${
                      simPaymentMethod === method
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Transmit POS Sale Webhook</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-VIEW 3: CSV SALES BATCH IMPORT */}
      {activeSubTab === 'csv_import' && (
        <div className="max-w-3xl bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-blue-600" />
                <span>POS Register Batch CSV Import</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bulk upload register settlement receipts to reconcile daily sales volume against inventory
              </p>
            </div>
            <button
              onClick={loadSampleCsv}
              className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
            >
              Load Sample Batch
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Target Facility</label>
              <select
                value={csvLocationId}
                onChange={(e) => setCsvLocationId(e.target.value)}
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
              <label className="block text-slate-700 font-medium mb-1">Source POS Terminal System</label>
              <select
                value={csvProvider}
                onChange={(e) => setCsvProvider(e.target.value as PosProvider)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="square">Square</option>
                <option value="shopify">Shopify POS</option>
                <option value="lightspeed">Lightspeed</option>
                <option value="clover">Clover</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium text-xs mb-1">
              CSV Content (Headers: OrderId, POS_Provider, SKU, Quantity, UnitPrice, Cashier)
            </label>
            <textarea
              rows={7}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Paste comma-delimited sales rows or click 'Load Sample Batch' above..."
              className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {csvResult && (
            <div
              className={`p-3 rounded text-xs ${
                csvResult.errors.length === 0
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}
            >
              <div className="font-bold">
                Batch Result: Successfully imported {csvResult.imported} of {csvResult.totalRows} sales transactions.
              </div>
              {csvResult.errors.length > 0 && (
                <div className="mt-2 text-[11px] space-y-1">
                  <div className="font-semibold text-amber-800">Warnings & Exceptions:</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {csvResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleExecuteCsvImport}
              disabled={!csvContent.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded transition-colors"
            >
              Parse and Process Batch
            </button>
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: SYNCED SALES LOG */}
      {activeSubTab === 'sales_log' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Synchronized POS Order Receipts
            </h2>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {posSales.length} total receipts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 font-semibold">Receipt Order ID</th>
                  <th className="py-2.5 px-4 font-semibold">Provider</th>
                  <th className="py-2.5 px-4 font-semibold">Facility</th>
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">Items Sold</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Total Amount</th>
                  <th className="py-2.5 px-4 font-semibold">Cashier</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {posSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      No POS sales have been received yet. Use the Simulator to fire a sale!
                    </td>
                  </tr>
                ) : (
                  posSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {sale.externalOrderId}
                      </td>
                      <td className="py-3 px-4 capitalize text-slate-700">
                        {sale.provider}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {sale.locationName}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(sale.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[11px] text-slate-700">
                          {sale.items.map((it) => `${it.quantity}x ${it.sku}`).join(', ')}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-slate-900">
                        ${sale.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {sale.cashierName}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-block text-[11px] font-semibold ${
                            sale.inventoryStatus === 'synced'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {sale.inventoryStatus === 'synced' ? 'SYNCED' : 'DISCREPANCY'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
