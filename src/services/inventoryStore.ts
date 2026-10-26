import {
  Product,
  ProductCategory,
  ProductVariant,
  StoreLocation,
  InventoryBalance,
  InventoryTransaction,
  PosIntegration,
  PosSale,
  PosSaleItem,
  ReconciliationSession,
  ReconciliationItem,
  AuditTrailEntry,
  User,
  UserRole,
  TransactionType,
  DiscrepancyReason,
  DiscrepancySeverity,
} from '../types/inventory';
import {
  INITIAL_USERS,
  INITIAL_CATEGORIES,
  INITIAL_LOCATIONS,
  INITIAL_PRODUCTS,
  INITIAL_BALANCES,
  INITIAL_TRANSACTIONS,
  INITIAL_POS_INTEGRATIONS,
  INITIAL_POS_SALES,
  INITIAL_RECONCILIATION_SESSIONS,
  INITIAL_AUDIT_LOGS,
} from '../data/mockSeed';

const STORAGE_KEY = 'omnistock_inventory_db_v1';

export interface AppState {
  currentUser: User;
  selectedLocationId: string; // 'all' or specific locationId
  products: Product[];
  categories: ProductCategory[];
  locations: StoreLocation[];
  balances: InventoryBalance[];
  transactions: InventoryTransaction[];
  posIntegrations: PosIntegration[];
  posSales: PosSale[];
  reconciliationSessions: ReconciliationSession[];
  auditLogs: AuditTrailEntry[];
}

class InventoryStore {
  private state: AppState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): AppState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          currentUser: INITIAL_USERS.find((u) => u.id === parsed.currentUser?.id) || INITIAL_USERS[0],
        };
      }
    } catch (e) {
      console.warn('Failed to load state from localStorage, initializing fresh seed data.', e);
    }

    return {
      currentUser: INITIAL_USERS[0], // Elena Rostova - Store Manager
      selectedLocationId: 'loc_flagship',
      products: INITIAL_PRODUCTS,
      categories: INITIAL_CATEGORIES,
      locations: INITIAL_LOCATIONS,
      balances: INITIAL_BALANCES,
      transactions: INITIAL_TRANSACTIONS,
      posIntegrations: INITIAL_POS_INTEGRATIONS,
      posSales: INITIAL_POS_SALES,
      reconciliationSessions: INITIAL_RECONCILIATION_SESSIONS,
      auditLogs: INITIAL_AUDIT_LOGS,
    };
  }

  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getState(): AppState {
    return this.state;
  }

  public resetDatabase(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.state = {
      currentUser: INITIAL_USERS[0],
      selectedLocationId: 'loc_flagship',
      products: INITIAL_PRODUCTS,
      categories: INITIAL_CATEGORIES,
      locations: INITIAL_LOCATIONS,
      balances: INITIAL_BALANCES,
      transactions: INITIAL_TRANSACTIONS,
      posIntegrations: INITIAL_POS_INTEGRATIONS,
      posSales: INITIAL_POS_SALES,
      reconciliationSessions: INITIAL_RECONCILIATION_SESSIONS,
      auditLogs: INITIAL_AUDIT_LOGS,
    };
    this.logAudit({
      action: 'DATABASE_RESET',
      entityType: 'BALANCE',
      entityId: 'ALL',
      details: 'Restored database to factory default seed records.',
    });
    this.saveState();
  }

  // User & Context Management
  public setCurrentUser(user: User): void {
    this.state.currentUser = user;
    this.logAudit({
      action: 'USER_ROLE_SWITCH',
      entityType: 'PRODUCT',
      entityId: user.id,
      details: `Switched active user profile to ${user.name} (${user.role.toUpperCase()})`,
    });
    this.saveState();
  }

  public setSelectedLocationId(locationId: string): void {
    this.state.selectedLocationId = locationId;
    this.saveState();
  }

  // Audit Logging
  private logAudit(entry: {
    action: string;
    entityType: AuditTrailEntry['entityType'];
    entityId: string;
    details: string;
    previousState?: string;
    newState?: string;
  }): void {
    const newEntry: AuditTrailEntry = {
      id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      userId: this.state.currentUser.id,
      userName: this.state.currentUser.name,
      userRole: this.state.currentUser.role,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details,
      ipAddress: '192.168.1.10 (Session Client)',
      previousState: entry.previousState,
      newState: entry.newState,
    };
    this.state.auditLogs = [newEntry, ...this.state.auditLogs];
  }

  // Inventory Balance Helpers
  public getBalance(skuId: string, locationId: string): InventoryBalance | undefined {
    return this.state.balances.find((b) => b.skuId === skuId && b.locationId === locationId);
  }

  public getOrCreateBalance(sku: ProductVariant, locationId: string, productName: string): InventoryBalance {
    const existing = this.getBalance(sku.id, locationId);
    if (existing) return existing;

    const loc = this.state.locations.find((l) => l.id === locationId);
    const newBal: InventoryBalance = {
      id: `bal_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      skuId: sku.id,
      sku: sku.sku,
      productName,
      variantName: sku.variantName,
      locationId,
      locationName: loc ? loc.name : 'Unknown Location',
      onHand: 0,
      allocated: 0,
      available: 0,
      minThreshold: 10,
      maxCapacity: 100,
      unitCost: sku.unitCost,
      unitPrice: sku.unitPrice,
      lastCountedAt: new Date().toISOString(),
    };
    this.state.balances.push(newBal);
    return newBal;
  }

  // 1. RECEIVE INVENTORY (Purchase Order intake)
  public recordReceipt(params: {
    skuId: string;
    locationId: string;
    quantity: number;
    unitCost: number;
    supplier: string;
    poNumber: string;
    notes?: string;
  }): { success: boolean; message: string } {
    if (params.quantity <= 0) {
      return { success: false, message: 'Quantity received must be greater than zero.' };
    }

    const sku = this.findSkuById(params.skuId);
    if (!sku) return { success: false, message: 'SKU not found.' };

    const loc = this.state.locations.find((l) => l.id === params.locationId);
    const product = this.state.products.find((p) => p.id === sku.productId);
    const balance = this.getOrCreateBalance(sku, params.locationId, product ? product.name : sku.variantName);

    const prevQty = balance.onHand;
    const newQty = prevQty + params.quantity;
    balance.onHand = newQty;
    balance.available = newQty - balance.allocated;
    balance.unitCost = params.unitCost;

    const tx: InventoryTransaction = {
      id: `tx_${Date.now()}`,
      timestamp: new Date().toISOString(),
      skuId: sku.id,
      sku: sku.sku,
      productName: product ? product.name : 'Product',
      variantName: sku.variantName,
      locationId: params.locationId,
      locationName: loc ? loc.name : 'Location',
      type: 'receipt',
      quantityDelta: params.quantity,
      balanceBefore: prevQty,
      balanceAfter: newQty,
      unitCost: params.unitCost,
      totalValuationDelta: params.quantity * params.unitCost,
      referenceType: 'PO',
      referenceId: params.poNumber || `PO-${Date.now().toString().slice(-6)}`,
      performedBy: this.state.currentUser.name,
      userRole: this.state.currentUser.role,
      notes: params.notes || `PO Intake from ${params.supplier}`,
    };

    this.state.transactions = [tx, ...this.state.transactions];

    this.logAudit({
      action: 'PURCHASE_ORDER_RECEIVED',
      entityType: 'TRANSACTION',
      entityId: tx.id,
      details: `Received ${params.quantity} units of ${sku.sku} at ${loc?.name}. PO: ${tx.referenceId}. Total value: +$${(params.quantity * params.unitCost).toFixed(2)}`,
      previousState: JSON.stringify({ onHand: prevQty }),
      newState: JSON.stringify({ onHand: newQty }),
    });

    this.saveState();
    return { success: true, message: `Successfully recorded receipt of ${params.quantity} units of ${sku.sku}.` };
  }

  // 2. INTER-STORE TRANSFER
  public recordTransfer(params: {
    skuId: string;
    sourceLocationId: string;
    destinationLocationId: string;
    quantity: number;
    transferOrderNumber: string;
    notes?: string;
  }): { success: boolean; message: string } {
    if (params.sourceLocationId === params.destinationLocationId) {
      return { success: false, message: 'Source and destination locations cannot be identical.' };
    }
    if (params.quantity <= 0) {
      return { success: false, message: 'Transfer quantity must be greater than zero.' };
    }

    const sku = this.findSkuById(params.skuId);
    if (!sku) return { success: false, message: 'SKU not found.' };

    const sourceBal = this.getBalance(sku.id, params.sourceLocationId);
    if (!sourceBal || sourceBal.onHand < params.quantity) {
      return {
        success: false,
        message: `Insufficient stock at source location. Available: ${sourceBal?.onHand ?? 0}, requested: ${params.quantity}.`,
      };
    }

    const product = this.state.products.find((p) => p.id === sku.productId);
    const destBal = this.getOrCreateBalance(sku, params.destinationLocationId, product ? product.name : sku.variantName);

    const srcLoc = this.state.locations.find((l) => l.id === params.sourceLocationId);
    const destLoc = this.state.locations.find((l) => l.id === params.destinationLocationId);

    // Decrement source
    const srcPrev = sourceBal.onHand;
    sourceBal.onHand -= params.quantity;
    sourceBal.available = sourceBal.onHand - sourceBal.allocated;

    // Increment destination
    const destPrev = destBal.onHand;
    destBal.onHand += params.quantity;
    destBal.available = destBal.onHand - destBal.allocated;

    const transferRef = params.transferOrderNumber || `TRF-${Date.now().toString().slice(-6)}`;

    // Outbound Tx
    const txOut: InventoryTransaction = {
      id: `tx_${Date.now()}_out`,
      timestamp: new Date().toISOString(),
      skuId: sku.id,
      sku: sku.sku,
      productName: product?.name || 'Product',
      variantName: sku.variantName,
      locationId: params.sourceLocationId,
      locationName: srcLoc?.name || 'Source',
      type: 'transfer_out',
      quantityDelta: -params.quantity,
      balanceBefore: srcPrev,
      balanceAfter: sourceBal.onHand,
      unitCost: sku.unitCost,
      totalValuationDelta: -(params.quantity * sku.unitCost),
      referenceType: 'TRANSFER_ORDER',
      referenceId: transferRef,
      performedBy: this.state.currentUser.name,
      userRole: this.state.currentUser.role,
      notes: `Transfer out to ${destLoc?.name}. ${params.notes || ''}`,
    };

    // Inbound Tx
    const txIn: InventoryTransaction = {
      id: `tx_${Date.now()}_in`,
      timestamp: new Date().toISOString(),
      skuId: sku.id,
      sku: sku.sku,
      productName: product?.name || 'Product',
      variantName: sku.variantName,
      locationId: params.destinationLocationId,
      locationName: destLoc?.name || 'Destination',
      type: 'transfer_in',
      quantityDelta: params.quantity,
      balanceBefore: destPrev,
      balanceAfter: destBal.onHand,
      unitCost: sku.unitCost,
      totalValuationDelta: params.quantity * sku.unitCost,
      referenceType: 'TRANSFER_ORDER',
      referenceId: transferRef,
      performedBy: this.state.currentUser.name,
      userRole: this.state.currentUser.role,
      notes: `Transfer in from ${srcLoc?.name}. ${params.notes || ''}`,
    };

    this.state.transactions = [txIn, txOut, ...this.state.transactions];

    this.logAudit({
      action: 'INTER_STORE_TRANSFER_EXECUTED',
      entityType: 'TRANSACTION',
      entityId: transferRef,
      details: `Transferred ${params.quantity} units of ${sku.sku} from ${srcLoc?.name} to ${destLoc?.name}.`,
    });

    this.saveState();
    return { success: true, message: `Successfully transferred ${params.quantity} units to ${destLoc?.name}.` };
  }

  // 3. POS SALES INGESTION & WEBHOOK SIMULATOR
  public ingestPosSale(sale: {
    provider: PosIntegration['provider'];
    locationId: string;
    items: { sku: string; quantity: number; unitPrice: number }[];
    externalOrderId?: string;
    cashierName?: string;
    paymentMethod?: 'card' | 'cash' | 'contactless' | 'gift_card';
  }): { success: boolean; orderId: string; discrepancies: string[] } {
    const orderId = sale.externalOrderId || `${sale.provider.toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const loc = this.state.locations.find((l) => l.id === sale.locationId);
    const discrepancies: string[] = [];

    const saleItems: PosSaleItem[] = [];
    let subtotal = 0;

    sale.items.forEach((item) => {
      const sku = this.findSkuByCode(item.sku);
      if (!sku) {
        discrepancies.push(`Unknown SKU in POS sale: ${item.sku}`);
        saleItems.push({
          sku: item.sku,
          productName: 'Unrecognized SKU (Discrepancy)',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxAmount: Number((item.unitPrice * item.quantity * 0.095).toFixed(2)),
        });
        subtotal += item.quantity * item.unitPrice;
        return;
      }

      const product = this.state.products.find((p) => p.id === sku.productId);
      const balance = this.getOrCreateBalance(sku, sale.locationId, product ? product.name : sku.variantName);

      if (balance.onHand < item.quantity) {
        discrepancies.push(`Negative stock alert for ${sku.sku}: on hand was ${balance.onHand}, sold ${item.quantity}`);
      }

      const prevQty = balance.onHand;
      const newQty = prevQty - item.quantity;
      balance.onHand = newQty;
      balance.available = newQty - balance.allocated;

      // Immutable transaction entry
      const tx: InventoryTransaction = {
        id: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        skuId: sku.id,
        sku: sku.sku,
        productName: product?.name || 'Product',
        variantName: sku.variantName,
        locationId: sale.locationId,
        locationName: loc?.name || 'Store',
        type: 'pos_sale',
        quantityDelta: -item.quantity,
        balanceBefore: prevQty,
        balanceAfter: newQty,
        unitCost: sku.unitCost,
        totalValuationDelta: -(item.quantity * sku.unitCost),
        referenceType: 'POS_RECEIPT',
        referenceId: orderId,
        performedBy: `${sale.provider.toUpperCase()} POS Sync`,
        userRole: 'store_associate',
        notes: `Automated POS sale ingestion, item price: $${item.unitPrice.toFixed(2)}`,
      };

      this.state.transactions = [tx, ...this.state.transactions];

      saleItems.push({
        sku: sku.sku,
        productName: product?.name || sku.variantName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxAmount: Number((item.unitPrice * item.quantity * 0.095).toFixed(2)),
      });
      subtotal += item.quantity * item.unitPrice;
    });

    const tax = Number((subtotal * 0.095).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));

    const newPosSale: PosSale = {
      id: `psale_${Date.now()}`,
      provider: sale.provider,
      externalOrderId: orderId,
      locationId: sale.locationId,
      locationName: loc?.name || 'Retail Store',
      terminalId: 'POS-TERM-01',
      cashierName: sale.cashierName || this.state.currentUser.name,
      timestamp: new Date().toISOString(),
      subtotal,
      tax,
      total,
      paymentMethod: sale.paymentMethod || 'card',
      items: saleItems,
      inventoryStatus: discrepancies.length > 0 ? 'discrepancy_alert' : 'synced',
    };

    this.state.posSales = [newPosSale, ...this.state.posSales];

    // Update integration metrics
    const integration = this.state.posIntegrations.find((pi) => pi.provider === sale.provider);
    if (integration) {
      integration.lastSyncAt = new Date().toISOString();
      integration.totalSyncedSales += 1;
      integration.totalSalesVolume += total;
    }

    this.logAudit({
      action: 'POS_SALE_PROCESSED',
      entityType: 'TRANSACTION',
      entityId: orderId,
      details: `Processed ${sale.provider.toUpperCase()} sale ${orderId} (${saleItems.length} items, $${total.toFixed(2)}). ${discrepancies.length ? 'Discrepancies flagged: ' + discrepancies.join('; ') : 'Balances updated.'}`,
    });

    this.saveState();
    return { success: true, orderId, discrepancies };
  }

  // 4. CSV IMPORT FOR POS SALES
  public importPosCsv(csvText: string, locationId: string, provider: PosIntegration['provider']): {
    totalRows: number;
    imported: number;
    errors: string[];
  } {
    const lines = csvText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) {
      return { totalRows: 0, imported: 0, errors: ['CSV file is empty or missing headers.'] };
    }

    const header = lines[0].toLowerCase().split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const skuIdx = header.findIndex((h) => h.includes('sku') || h.includes('item_code'));
    const qtyIdx = header.findIndex((h) => h.includes('qty') || h.includes('quantity'));
    const priceIdx = header.findIndex((h) => h.includes('price') || h.includes('amount'));
    const orderIdx = header.findIndex((h) => h.includes('order') || h.includes('receipt') || h.includes('id'));

    if (skuIdx === -1 || qtyIdx === -1) {
      return {
        totalRows: lines.length - 1,
        imported: 0,
        errors: ['CSV must contain at least "SKU" and "Quantity" columns.'],
      };
    }

    let importedCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (row.length < 2) continue;

      const skuCode = row[skuIdx];
      const qty = parseInt(row[qtyIdx], 10);
      const price = priceIdx !== -1 && row[priceIdx] ? parseFloat(row[priceIdx]) : 0;
      const orderId = orderIdx !== -1 && row[orderIdx] ? row[orderIdx] : `CSV-BATCH-${Date.now()}-${i}`;

      if (!skuCode || isNaN(qty) || qty <= 0) {
        errors.push(`Row ${i + 1}: Invalid SKU or non-positive quantity.`);
        continue;
      }

      const result = this.ingestPosSale({
        provider,
        locationId,
        externalOrderId: orderId,
        items: [{ sku: skuCode, quantity: qty, unitPrice: price || 50.0 }],
      });

      if (result.success) {
        importedCount += 1;
        if (result.discrepancies.length > 0) {
          errors.push(`Row ${i + 1} (${skuCode}): ${result.discrepancies.join(', ')}`);
        }
      }
    }

    this.logAudit({
      action: 'POS_CSV_BATCH_IMPORTED',
      entityType: 'POS_SYNC',
      entityId: `BATCH_${Date.now()}`,
      details: `Imported ${importedCount} of ${lines.length - 1} records from CSV for ${provider}. Encountered ${errors.length} warnings/exceptions.`,
    });

    this.saveState();
    return { totalRows: lines.length - 1, imported: importedCount, errors };
  }

  // 5. PHYSICAL COUNT & RECONCILIATION WORKFLOW
  public startReconciliationSession(params: {
    locationId: string;
    categoryFilter?: string;
  }): ReconciliationSession {
    const loc = this.state.locations.find((l) => l.id === params.locationId);
    const sessionCode = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`;

    // Filter SKUs
    let balances = this.state.balances.filter((b) => b.locationId === params.locationId);
    if (params.categoryFilter && params.categoryFilter !== 'all') {
      const category = this.state.categories.find((c) => c.id === params.categoryFilter);
      if (category) {
        const prodIds = new Set(this.state.products.filter((p) => p.categoryId === category.id).map((p) => p.id));
        balances = balances.filter((b) => {
          const sku = this.findSkuById(b.skuId);
          return sku && prodIds.has(sku.productId);
        });
      }
    }

    const items: ReconciliationItem[] = balances.map((bal) => {
      const sku = this.findSkuById(bal.skuId);
      return {
        id: `ri_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        sessionId: '', // filled below
        skuId: bal.skuId,
        sku: bal.sku,
        barcode: sku?.barcode || '000000000000',
        productName: bal.productName,
        variantName: bal.variantName,
        expectedOnHand: bal.onHand,
        physicalCount: null, // Pending count
        varianceUnits: 0,
        unitCost: bal.unitCost,
        varianceCost: 0,
        severity: 'match',
        reasonCode: 'unresolved',
        counterNotes: '',
        isReviewed: false,
      };
    });

    const session: ReconciliationSession = {
      id: `rec_sess_${Date.now()}`,
      sessionCode,
      locationId: params.locationId,
      locationName: loc?.name || 'Retail Store',
      categoryFilter: params.categoryFilter === 'all' ? 'All Inventory' : params.categoryFilter,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      startedBy: `${this.state.currentUser.name} (${this.state.currentUser.role})`,
      totalExpectedUnits: balances.reduce((acc, b) => acc + b.onHand, 0),
      totalCountedUnits: 0,
      netVarianceUnits: 0,
      netVarianceCost: 0,
      varianceRatePercent: 0,
      items: items.map((it) => ({ ...it, sessionId: `rec_sess_${Date.now()}` })),
    };

    this.state.reconciliationSessions = [session, ...this.state.reconciliationSessions];

    this.logAudit({
      action: 'RECONCILIATION_SESSION_STARTED',
      entityType: 'RECONCILIATION',
      entityId: session.sessionCode,
      details: `Initiated physical count session for ${loc?.name}. Expected: ${session.totalExpectedUnits} units across ${items.length} SKUs.`,
    });

    this.saveState();
    return session;
  }

  public updatePhysicalCount(params: {
    sessionId: string;
    skuId: string;
    physicalCount: number;
    counterNotes?: string;
    reasonCode?: DiscrepancyReason;
  }): void {
    const session = this.state.reconciliationSessions.find((s) => s.id === params.sessionId);
    if (!session) return;

    const item = session.items.find((i) => i.skuId === params.skuId);
    if (!item) return;

    item.physicalCount = params.physicalCount;
    if (params.counterNotes !== undefined) item.counterNotes = params.counterNotes;
    if (params.reasonCode) item.reasonCode = params.reasonCode;

    // Recalculate item variance
    item.varianceUnits = item.physicalCount - item.expectedOnHand;
    item.varianceCost = item.varianceUnits * item.unitCost;

    if (item.varianceUnits === 0) {
      item.severity = 'match';
    } else if (item.varianceUnits < 0) {
      item.severity = Math.abs(item.varianceCost) > 100 || Math.abs(item.varianceUnits) >= 3 ? 'critical_shrinkage' : 'minor';
    } else {
      item.severity = item.varianceUnits >= 3 ? 'critical_surplus' : 'minor';
    }

    // Recalculate session totals
    const countedItems = session.items.filter((i) => i.physicalCount !== null);
    session.totalCountedUnits = countedItems.reduce((acc, i) => acc + (i.physicalCount || 0), 0);
    session.netVarianceUnits = session.items.reduce((acc, i) => acc + (i.physicalCount !== null ? i.varianceUnits : 0), 0);
    session.netVarianceCost = session.items.reduce((acc, i) => acc + (i.physicalCount !== null ? i.varianceCost : 0), 0);
    session.varianceRatePercent = session.totalExpectedUnits > 0
      ? Number(((session.netVarianceUnits / session.totalExpectedUnits) * 100).toFixed(2))
      : 0;

    this.saveState();
  }

  public submitSessionForManagerReview(sessionId: string, counterSummaryNotes?: string): { success: boolean; message: string } {
    const session = this.state.reconciliationSessions.find((s) => s.id === sessionId);
    if (!session) return { success: false, message: 'Session not found.' };

    const uncounted = session.items.filter((i) => i.physicalCount === null);
    if (uncounted.length > 0) {
      return {
        success: false,
        message: `${uncounted.length} SKUs have not been counted yet. Please count all items or enter 0 before submitting for approval.`,
      };
    }

    session.status = 'pending_manager_approval';
    session.completedAt = new Date().toISOString();
    if (counterSummaryNotes) {
      session.managerNotes = counterSummaryNotes;
    }

    this.logAudit({
      action: 'PHYSICAL_COUNT_SUBMITTED_FOR_REVIEW',
      entityType: 'RECONCILIATION',
      entityId: session.sessionCode,
      details: `Count completed for ${session.locationName}. Net variance: ${session.netVarianceUnits} units ($${session.netVarianceCost.toFixed(2)}). Awaiting Manager sign-off.`,
    });

    this.saveState();
    return { success: true, message: 'Reconciliation session submitted to Store Manager for formal review.' };
  }

  public approveAndFinalizeReconciliation(params: {
    sessionId: string;
    managerNotes: string;
    itemReasonCodes?: Record<string, DiscrepancyReason>;
  }): { success: boolean; message: string; adjustmentsCreated: number } {
    const userRole = this.state.currentUser.role;
    if (userRole === 'store_associate') {
      return {
        success: false,
        message: 'Permission denied: Store Associates cannot finalize adjustments. Store Manager or Operations Director role required.',
        adjustmentsCreated: 0,
      };
    }

    const session = this.state.reconciliationSessions.find((s) => s.id === params.sessionId);
    if (!session) return { success: false, message: 'Session not found.', adjustmentsCreated: 0 };
    if (session.status === 'approved_posted') {
      return { success: false, message: 'This session has already been finalized and posted.', adjustmentsCreated: 0 };
    }

    let adjustmentsCount = 0;

    // Apply adjustments for every item with non-zero variance
    session.items.forEach((item) => {
      if (params.itemReasonCodes && params.itemReasonCodes[item.id]) {
        item.reasonCode = params.itemReasonCodes[item.id];
      }
      item.isReviewed = true;

      if (item.physicalCount !== null && item.varianceUnits !== 0) {
        adjustmentsCount += 1;
        const balance = this.getBalance(item.skuId, session.locationId);
        const prevOnHand = balance ? balance.onHand : item.expectedOnHand;
        const newOnHand = item.physicalCount;

        if (balance) {
          balance.onHand = newOnHand;
          balance.available = newOnHand - balance.allocated;
          balance.lastCountedAt = new Date().toISOString();
        }

        const txType: TransactionType =
          item.varianceUnits < 0 ? 'adjustment_shrinkage' : 'adjustment_surplus';

        const tx: InventoryTransaction = {
          id: `tx_${Date.now()}_${adjustmentsCount}`,
          timestamp: new Date().toISOString(),
          skuId: item.skuId,
          sku: item.sku,
          productName: item.productName,
          variantName: item.variantName,
          locationId: session.locationId,
          locationName: session.locationName,
          type: txType,
          quantityDelta: item.varianceUnits,
          balanceBefore: prevOnHand,
          balanceAfter: newOnHand,
          unitCost: item.unitCost,
          totalValuationDelta: item.varianceCost,
          referenceType: 'RECON_SESSION',
          referenceId: session.sessionCode,
          performedBy: this.state.currentUser.name,
          userRole: this.state.currentUser.role,
          notes: `Reconciliation adjustment (${item.reasonCode}). Manager notes: ${params.managerNotes}`,
        };

        this.state.transactions = [tx, ...this.state.transactions];
      }
    });

    session.status = 'approved_posted';
    session.finalizedAt = new Date().toISOString();
    session.finalizedBy = `${this.state.currentUser.name} (${this.state.currentUser.role})`;
    session.managerNotes = params.managerNotes;

    this.logAudit({
      action: 'RECONCILIATION_APPROVED_AND_POSTED',
      entityType: 'RECONCILIATION',
      entityId: session.sessionCode,
      details: `Approved reconciliation ${session.sessionCode}. Posted ${adjustmentsCount} stock adjustments. Net valuation impact: $${session.netVarianceCost.toFixed(2)}.`,
    });

    this.saveState();
    return {
      success: true,
      message: `Reconciliation finalized! Posted ${adjustmentsCount} inventory adjustments with audit approval.`,
      adjustmentsCreated: adjustmentsCount,
    };
  }

  // 6. SQL RUNNER (Live query evaluator for MySQL Console Studio)
  public executeSqlQuery(sql: string): {
    columns: string[];
    rows: any[];
    executionTimeMs: number;
    error?: string;
  } {
    const startTime = performance.now();
    const cleanSql = sql.trim().replace(/;$/, '');
    const upper = cleanSql.toUpperCase();

    try {
      if (upper === 'SHOW TABLES') {
        const rows = [
          { Tables_in_omnistock: 'products' },
          { Tables_in_omnistock: 'product_variants' },
          { Tables_in_omnistock: 'product_categories' },
          { Tables_in_omnistock: 'store_locations' },
          { Tables_in_omnistock: 'inventory_balances' },
          { Tables_in_omnistock: 'inventory_transactions' },
          { Tables_in_omnistock: 'pos_integrations' },
          { Tables_in_omnistock: 'pos_sales' },
          { Tables_in_omnistock: 'reconciliation_sessions' },
          { Tables_in_omnistock: 'reconciliation_items' },
          { Tables_in_omnistock: 'audit_trail_entries' },
          { Tables_in_omnistock: 'users' },
        ];
        return {
          columns: ['Tables_in_omnistock'],
          rows,
          executionTimeMs: Math.round(performance.now() - startTime),
        };
      }

      if (upper.startsWith('DESCRIBE ') || upper.startsWith('DESC ')) {
        const tableName = cleanSql.split(' ')[1].toLowerCase().replace(/[`'"]/g, '');
        return this.describeTable(tableName, startTime);
      }

      if (upper.startsWith('SELECT')) {
        return this.evaluateSelectQuery(cleanSql, startTime);
      }

      return {
        columns: [],
        rows: [],
        executionTimeMs: Math.round(performance.now() - startTime),
        error: 'Only SELECT, SHOW TABLES, and DESCRIBE commands are permitted in the interactive inspection console.',
      };
    } catch (e: any) {
      return {
        columns: [],
        rows: [],
        executionTimeMs: Math.round(performance.now() - startTime),
        error: e.message || 'SQL execution failed.',
      };
    }
  }

  private describeTable(tableName: string, startTime: number) {
    const schemaMap: Record<string, any[]> = {
      products: [
        { Field: 'id', Type: 'varchar(36)', Null: 'NO', Key: 'PRI', Default: 'NULL' },
        { Field: 'name', Type: 'varchar(200)', Null: 'NO', Key: '', Default: 'NULL' },
        { Field: 'brand', Type: 'varchar(100)', Null: 'NO', Key: 'MUL', Default: 'NULL' },
        { Field: 'category_id', Type: 'varchar(36)', Null: 'NO', Key: 'MUL', Default: 'NULL' },
        { Field: 'image_url', Type: 'varchar(500)', Null: 'YES', Key: '', Default: 'NULL' },
        { Field: 'status', Type: "enum('active','discontinued','draft')", Null: 'NO', Key: '', Default: 'active' },
      ],
      product_variants: [
        { Field: 'id', Type: 'varchar(36)', Null: 'NO', Key: 'PRI', Default: 'NULL' },
        { Field: 'sku', Type: 'varchar(60)', Null: 'NO', Key: 'UNI', Default: 'NULL' },
        { Field: 'barcode', Type: 'varchar(50)', Null: 'NO', Key: 'UNI', Default: 'NULL' },
        { Field: 'variant_name', Type: 'varchar(120)', Null: 'NO', Key: '', Default: 'NULL' },
        { Field: 'unit_cost', Type: 'decimal(12,4)', Null: 'NO', Key: '', Default: '0.0000' },
        { Field: 'unit_price', Type: 'decimal(12,4)', Null: 'NO', Key: '', Default: '0.0000' },
        { Field: 'supplier', Type: 'varchar(150)', Null: 'NO', Key: '', Default: 'NULL' },
      ],
      inventory_balances: [
        { Field: 'id', Type: 'varchar(36)', Null: 'NO', Key: 'PRI', Default: 'NULL' },
        { Field: 'sku_id', Type: 'varchar(36)', Null: 'NO', Key: 'MUL', Default: 'NULL' },
        { Field: 'location_id', Type: 'varchar(36)', Null: 'NO', Key: 'MUL', Default: 'NULL' },
        { Field: 'quantity_on_hand', Type: 'int', Null: 'NO', Key: 'MUL', Default: '0' },
        { Field: 'quantity_allocated', Type: 'int', Null: 'NO', Key: '', Default: '0' },
        { Field: 'quantity_available', Type: 'int (virtual)', Null: 'NO', Key: '', Default: 'NULL' },
        { Field: 'min_reorder_point', Type: 'int', Null: 'NO', Key: 'MUL', Default: '10' },
      ],
      inventory_transactions: [
        { Field: 'id', Type: 'varchar(36)', Null: 'NO', Key: 'PRI', Default: 'NULL' },
        { Field: 'sku_id', Type: 'varchar(36)', Null: 'NO', Key: 'MUL', Default: 'NULL' },
        { Field: 'location_id', Type: 'varchar(36)', Null: 'NO', Key: 'MUL', Default: 'NULL' },
        { Field: 'transaction_type', Type: "enum('receipt','pos_sale','return','transfer')", Null: 'NO', Key: 'MUL', Default: 'NULL' },
        { Field: 'quantity_delta', Type: 'int', Null: 'NO', Key: '', Default: 'NULL' },
        { Field: 'balance_before', Type: 'int', Null: 'NO', Key: '', Default: 'NULL' },
        { Field: 'balance_after', Type: 'int', Null: 'NO', Key: '', Default: 'NULL' },
        { Field: 'total_valuation_delta', Type: 'decimal(14,4)', Null: 'NO', Key: '', Default: 'NULL' },
        { Field: 'reference_id', Type: 'varchar(100)', Null: 'NO', Key: 'MUL', Default: 'NULL' },
      ],
    };

    const rows = schemaMap[tableName] || [
      { Field: 'id', Type: 'varchar(36)', Null: 'NO', Key: 'PRI', Default: 'NULL' },
      { Field: 'created_at', Type: 'timestamp', Null: 'NO', Key: '', Default: 'CURRENT_TIMESTAMP' },
    ];

    return {
      columns: ['Field', 'Type', 'Null', 'Key', 'Default'],
      rows,
      executionTimeMs: Math.round(performance.now() - startTime),
    };
  }

  private evaluateSelectQuery(sql: string, startTime: number) {
    const lower = sql.toLowerCase();
    let data: any[] = [];
    let tableName = 'custom';

    if (lower.includes('products')) {
      tableName = 'products';
      data = this.state.products.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.categoryName,
        variants_count: p.variants.length,
        status: 'active',
      }));
    } else if (lower.includes('product_variants') || lower.includes('skus') || lower.includes('variants')) {
      tableName = 'product_variants';
      data = this.state.products.flatMap((p) =>
        p.variants.map((v) => ({
          sku_id: v.id,
          sku: v.sku,
          barcode: v.barcode,
          product_name: p.name,
          variant: v.variantName,
          cost: `$${v.unitCost.toFixed(2)}`,
          retail_price: `$${v.unitPrice.toFixed(2)}`,
          supplier: v.supplier,
        }))
      );
    } else if (lower.includes('inventory_balances') || lower.includes('balances')) {
      tableName = 'inventory_balances';
      data = this.state.balances.map((b) => ({
        sku: b.sku,
        product: b.productName,
        variant: b.variantName,
        location: b.locationName,
        on_hand: b.onHand,
        allocated: b.allocated,
        available: b.available,
        min_reorder: b.minThreshold,
        stock_status: b.onHand <= b.minThreshold ? 'LOW_STOCK' : 'HEALTHY',
      }));
    } else if (lower.includes('inventory_transactions') || lower.includes('transactions')) {
      tableName = 'inventory_transactions';
      data = this.state.transactions.map((t) => ({
        id: t.id,
        time: t.timestamp.slice(0, 19).replace('T', ' '),
        sku: t.sku,
        type: t.type,
        delta: t.quantityDelta > 0 ? `+${t.quantityDelta}` : `${t.quantityDelta}`,
        balance_after: t.balanceAfter,
        ref_id: t.referenceId,
        actor: t.performedBy,
      }));
    } else if (lower.includes('reconciliation_items') || lower.includes('exceptions')) {
      tableName = 'reconciliation_items';
      data = this.state.reconciliationSessions.flatMap((s) =>
        s.items.map((i) => ({
          session_code: s.sessionCode,
          sku: i.sku,
          expected: i.expectedOnHand,
          physical: i.physicalCount !== null ? i.physicalCount : 'PENDING',
          variance_units: i.varianceUnits,
          variance_cost: `$${i.varianceCost.toFixed(2)}`,
          reason_code: i.reasonCode,
          severity: i.severity,
        }))
      );
    } else if (lower.includes('audit_trail') || lower.includes('audit_logs') || lower.includes('audit')) {
      tableName = 'audit_trail_entries';
      data = this.state.auditLogs.map((a) => ({
        id: a.id,
        timestamp: a.timestamp.slice(0, 19).replace('T', ' '),
        actor: `${a.userName} (${a.userRole})`,
        action: a.action,
        entity: `${a.entityType}:${a.entityId}`,
        details: a.details,
      }));
    } else if (lower.includes('pos_sales') || lower.includes('pos')) {
      tableName = 'pos_sales';
      data = this.state.posSales.map((ps) => ({
        order_id: ps.externalOrderId,
        provider: ps.provider,
        location: ps.locationName,
        total: `$${ps.total.toFixed(2)}`,
        items_count: ps.items.length,
        status: ps.inventoryStatus,
        cashier: ps.cashierName,
      }));
    } else {
      data = this.state.locations.map((l) => ({
        code: l.code,
        name: l.name,
        type: l.type,
        city: l.city,
        manager: l.manager,
      }));
    }

    // Basic LIMIT filter
    const limitMatch = sql.match(/limit\s+(\d+)/i);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1], 10);
      data = data.slice(0, limit);
    }

    const columns = data.length > 0 ? Object.keys(data[0]) : ['result'];

    return {
      columns,
      rows: data,
      executionTimeMs: Math.round(performance.now() - startTime),
    };
  }

  // 7. EXPORT FULL MYSQL DDL + SEED DATA AS .SQL DUMP
  public generateFullMysqlDump(): string {
    const dateStr = new Date().toISOString();
    let dump = `-- =====================================================================\n`;
    dump += `-- OmniStock Retail Inventory & POS Management MySQL 8.0 Export\n`;
    dump += `-- Generated: ${dateStr}\n`;
    dump += `-- Host: 127.0.0.1  Database: omnistock_inventory\n`;
    dump += `-- =====================================================================\n\n`;

    dump += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    // Dump categories
    dump += `-- Categories --\n`;
    dump += `INSERT INTO \`product_categories\` (\`id\`, \`code\`, \`name\`, \`description\`) VALUES\n`;
    dump += this.state.categories
      .map((c) => `('${c.id}', '${c.code}', '${c.name.replace(/'/g, "''")}', '${c.description.replace(/'/g, "''")}')`)
      .join(',\n') + ';\n\n';

    // Dump locations
    dump += `-- Locations --\n`;
    dump += `INSERT INTO \`store_locations\` (\`id\`, \`location_code\`, \`name\`, \`type\`, \`address\`, \`city\`, \`manager_name\`, \`phone\`) VALUES\n`;
    dump += this.state.locations
      .map(
        (l) =>
          `('${l.id}', '${l.code}', '${l.name.replace(/'/g, "''")}', '${l.type}', '${l.address.replace(/'/g, "''")}', '${l.city}', '${l.manager}', '${l.phone}')`
      )
      .join(',\n') + ';\n\n';

    // Dump products
    dump += `-- Products --\n`;
    dump += `INSERT INTO \`products\` (\`id\`, \`sku_base\`, \`name\`, \`brand\`, \`category_id\`, \`description\`, \`status\`) VALUES\n`;
    dump += this.state.products
      .map(
        (p) =>
          `('${p.id}', '${p.variants[0]?.sku.split('-').slice(0, 2).join('-') || 'SKU'}', '${p.name.replace(/'/g, "''")}', '${p.brand.replace(/'/g, "''")}', '${p.categoryId}', '${p.description.replace(/'/g, "''")}', 'active')`
      )
      .join(',\n') + ';\n\n';

    // Dump SKUs
    dump += `-- Product Variants / SKUs --\n`;
    dump += `INSERT INTO \`product_variants\` (\`id\`, \`product_id\`, \`sku\`, \`barcode\`, \`variant_name\`, \`attributes_json\`, \`unit_cost\`, \`unit_price\`, \`supplier\`) VALUES\n`;
    const skuRows = this.state.products.flatMap((p) =>
      p.variants.map(
        (v) =>
          `('${v.id}', '${v.productId}', '${v.sku}', '${v.barcode}', '${v.variantName.replace(/'/g, "''")}', '${JSON.stringify(v.attributes)}', ${v.unitCost.toFixed(4)}, ${v.unitPrice.toFixed(4)}, '${v.supplier.replace(/'/g, "''")}')`
      )
    );
    dump += skuRows.join(',\n') + ';\n\n';

    // Dump balances
    dump += `-- Inventory Balances --\n`;
    dump += `INSERT INTO \`inventory_balances\` (\`id\`, \`sku_id\`, \`location_id\`, \`quantity_on_hand\`, \`quantity_allocated\`, \`min_reorder_point\`, \`max_capacity\`) VALUES\n`;
    dump += this.state.balances
      .map(
        (b) =>
          `('${b.id}', '${b.skuId}', '${b.locationId}', ${b.onHand}, ${b.allocated}, ${b.minThreshold}, ${b.maxCapacity})`
      )
      .join(',\n') + ';\n\n';

    dump += `SET FOREIGN_KEY_CHECKS = 1;\n`;
    return dump;
  }

  // Helper Finders
  public findSkuById(skuId: string): ProductVariant | undefined {
    for (const p of this.state.products) {
      const v = p.variants.find((variant) => variant.id === skuId);
      if (v) return v;
    }
    return undefined;
  }

  public findSkuByCode(skuOrBarcode: string): ProductVariant | undefined {
    const q = skuOrBarcode.trim().toLowerCase();
    for (const p of this.state.products) {
      const v = p.variants.find((variant) => variant.sku.toLowerCase() === q || variant.barcode.toLowerCase() === q);
      if (v) return v;
    }
    return undefined;
  }
}

export const inventoryStore = new InventoryStore();
