export type UserRole = 'store_associate' | 'store_manager' | 'operations_director' | 'inventory_auditor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeLocationId: string;
  avatarUrl: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  code: string;
  description: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  barcode: string;
  variantName: string; // e.g. "Olive Green / M"
  attributes: Record<string, string>; // { size: 'M', color: 'Olive Green' }
  unitCost: number;
  unitPrice: number;
  weightGrams?: number;
  supplier: string;
  supplierCode: string;
  leadTimeDays: number;
  status: 'active' | 'discontinued' | 'draft';
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  categoryId: string;
  categoryName: string;
  description: string;
  imageUrl: string;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface StoreLocation {
  id: string;
  name: string;
  code: string;
  type: 'central_warehouse' | 'retail_flagship' | 'mall_boutique' | 'fulfillment_hub';
  address: string;
  city: string;
  manager: string;
  phone: string;
}

export interface InventoryBalance {
  id: string;
  skuId: string;
  sku: string;
  productName: string;
  variantName: string;
  locationId: string;
  locationName: string;
  onHand: number;
  allocated: number; // Reserved for orders
  available: number; // onHand - allocated
  minThreshold: number; // Reorder point
  maxCapacity: number;
  unitCost: number;
  unitPrice: number;
  lastCountedAt: string;
}

export type TransactionType =
  | 'receipt'
  | 'pos_sale'
  | 'customer_return'
  | 'transfer_out'
  | 'transfer_in'
  | 'adjustment_shrinkage'
  | 'adjustment_surplus'
  | 'damage_write_off';

export interface InventoryTransaction {
  id: string;
  timestamp: string;
  skuId: string;
  sku: string;
  productName: string;
  variantName: string;
  locationId: string;
  locationName: string;
  type: TransactionType;
  quantityDelta: number; // Positive or negative
  balanceBefore: number;
  balanceAfter: number;
  unitCost: number;
  totalValuationDelta: number;
  referenceType: 'PO' | 'POS_RECEIPT' | 'RETURN_AUTH' | 'TRANSFER_ORDER' | 'RECON_SESSION' | 'MANUAL_AUDIT';
  referenceId: string;
  performedBy: string;
  userRole: UserRole;
  notes: string;
}

export type PosProvider = 'square' | 'shopify' | 'lightspeed' | 'clover' | 'toast';

export interface PosIntegration {
  id: string;
  provider: PosProvider;
  name: string;
  locationId: string;
  status: 'active' | 'syncing' | 'error' | 'paused';
  apiKeyMasked: string;
  webhookEndpoint: string;
  lastSyncAt: string;
  totalSyncedSales: number;
  totalSalesVolume: number;
}

export interface PosSaleItem {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
}

export interface PosSale {
  id: string;
  provider: PosProvider;
  externalOrderId: string;
  locationId: string;
  locationName: string;
  terminalId: string;
  cashierName: string;
  timestamp: string;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'card' | 'cash' | 'contactless' | 'gift_card';
  items: PosSaleItem[];
  inventoryStatus: 'synced' | 'pending_reconciliation' | 'discrepancy_alert';
}

export type DiscrepancySeverity = 'match' | 'minor' | 'critical_shrinkage' | 'critical_surplus';

export type DiscrepancyReason =
  | 'theft_shoplifting'
  | 'damaged_spoilage'
  | 'pos_misscan'
  | 'vendor_shortage'
  | 'unrecorded_return'
  | 'clerical_count_error'
  | 'unresolved';

export interface ReconciliationItem {
  id: string;
  sessionId: string;
  skuId: string;
  sku: string;
  barcode: string;
  productName: string;
  variantName: string;
  expectedOnHand: number;
  physicalCount: number | null; // null if not yet counted
  varianceUnits: number; // physical - expected
  unitCost: number;
  varianceCost: number; // varianceUnits * unitCost
  severity: DiscrepancySeverity;
  reasonCode: DiscrepancyReason;
  counterNotes: string;
  isReviewed: boolean;
}

export type ReconciliationStatus = 'in_progress' | 'pending_manager_approval' | 'approved_posted' | 'cancelled';

export interface ReconciliationSession {
  id: string;
  sessionCode: string; // e.g. "REC-2026-1025-01"
  locationId: string;
  locationName: string;
  categoryFilter?: string;
  status: ReconciliationStatus;
  startedAt: string;
  completedAt?: string;
  finalizedAt?: string;
  startedBy: string;
  finalizedBy?: string;
  items: ReconciliationItem[];
  totalExpectedUnits: number;
  totalCountedUnits: number;
  netVarianceUnits: number;
  netVarianceCost: number;
  varianceRatePercent: number;
  managerNotes?: string;
}

export interface AuditTrailEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string; // e.g., "RECEIPT_POSTED", "PHYSICAL_COUNT_SUBMITTED", "RECONCILIATION_APPROVED"
  entityType: 'PRODUCT' | 'VARIANT' | 'BALANCE' | 'TRANSACTION' | 'RECONCILIATION' | 'POS_SYNC';
  entityId: string;
  details: string;
  ipAddress: string;
  previousState?: string;
  newState?: string;
}
