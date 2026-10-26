/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { inventoryStore, AppState } from './services/inventoryStore';
import { Header, ActiveTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ProductsView } from './components/ProductsView';
import { TransactionsView } from './components/TransactionsView';
import { PosIntegrationView } from './components/PosIntegrationView';
import { ReconciliationView } from './components/ReconciliationView';
import { DatabaseSchemaView } from './components/DatabaseSchemaView';
import { AuditTrailView } from './components/AuditTrailView';
import { PurchaseOrderReceiptModal } from './components/PurchaseOrderReceiptModal';

export default function App() {
  const [state, setState] = useState<AppState>(inventoryStore.getState());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [preselectedSkuForReceipt, setPreselectedSkuForReceipt] = useState<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = inventoryStore.subscribe(() => {
      setState({ ...inventoryStore.getState() });
    });
    return () => unsubscribe();
  }, []);

  const handleOpenReceiptModal = (skuId?: string) => {
    setPreselectedSkuForReceipt(skuId);
    setShowReceiptModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      {/* Top Bar adhering to Top Bar Contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={state.currentUser}
        locations={state.locations}
        selectedLocationId={state.selectedLocationId}
        onLocationChange={(locId) => inventoryStore.setSelectedLocationId(locId)}
        onResetDb={() => inventoryStore.resetDatabase()}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            state={state}
            setActiveTab={setActiveTab}
            onOpenReceiptModal={() => handleOpenReceiptModal()}
          />
        )}

        {activeTab === 'inventory' && (
          <ProductsView
            state={state}
            onOpenReceiptModal={(skuId) => handleOpenReceiptModal(skuId)}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            state={state}
            onOpenReceiptModal={() => handleOpenReceiptModal()}
          />
        )}

        {activeTab === 'pos' && (
          <PosIntegrationView state={state} />
        )}

        {activeTab === 'reconciliation' && (
          <ReconciliationView state={state} />
        )}

        {activeTab === 'mysql_studio' && (
          <DatabaseSchemaView state={state} />
        )}

        {activeTab === 'audit' && (
          <AuditTrailView state={state} />
        )}
      </main>

      {/* Global Purchase Order Receipt Modal */}
      {showReceiptModal && (
        <PurchaseOrderReceiptModal
          state={state}
          preselectedSkuId={preselectedSkuForReceipt}
          onClose={() => setShowReceiptModal(false)}
        />
      )}

      {/* Subtle, Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">OmniStock Retail Inventory</span>
            <span aria-hidden="true">·</span>
            <span>MySQL 8.0 Central Architecture</span>
            <span aria-hidden="true">·</span>
            <span>POS Sync & Cycle Count Reconciliation</span>
          </div>
          <div>
            <span>Authenticated as </span>
            <span className="font-semibold text-slate-800">{state.currentUser.name}</span>
            <span className="text-slate-400"> ({state.currentUser.role.replace(/_/g, ' ')})</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
