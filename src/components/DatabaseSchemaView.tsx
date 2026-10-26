import React, { useState } from 'react';
import { AppState, inventoryStore } from '../services/inventoryStore';
import { 
  Database, 
  Table, 
  Terminal, 
  Download, 
  Play, 
  Layers, 
  CheckCircle2, 
  Code,
  FileCode,
  Sparkles,
  Copy,
  Check
} from 'lucide-react';

interface DatabaseSchemaViewProps {
  state: AppState;
}

export const DatabaseSchemaView: React.FC<DatabaseSchemaViewProps> = ({ state }) => {
  const [activeTab, setActiveTab] = useState<'tables' | 'query_console' | 'ddl_code'>('tables');
  const [selectedTable, setSelectedTable] = useState<string>('inventory_balances');

  // SQL Console state
  const [sqlQuery, setSqlQuery] = useState<string>(
    'SELECT * FROM inventory_balances WHERE on_hand <= min_reorder_point'
  );
  const [queryResult, setQueryResult] = useState<{
    columns: string[];
    rows: any[];
    executionTimeMs: number;
    error?: string;
  } | null>(null);

  const [copiedDdl, setCopiedDdl] = useState(false);

  const tableDefinitions: Record<
    string,
    {
      description: string;
      engine: string;
      rowCount: number;
      columns: { name: string; type: string; key?: string; description: string }[];
    }
  > = {
    products: {
      description: 'Central product master table defining parent brand, category, and core item details.',
      engine: 'InnoDB (MySQL 8.0+)',
      rowCount: state.products.length,
      columns: [
        { name: 'id', type: 'VARCHAR(36)', key: 'PRIMARY KEY', description: 'Unique product identifier (UUID)' },
        { name: 'sku_base', type: 'VARCHAR(50)', key: 'UNIQUE', description: 'Base SKU family prefix' },
        { name: 'name', type: 'VARCHAR(200)', description: 'Product commercial name' },
        { name: 'brand', type: 'VARCHAR(100)', description: 'Brand or label manufacturer' },
        { name: 'category_id', type: 'VARCHAR(36)', key: 'FOREIGN KEY', description: 'Ref product_categories(id)' },
        { name: 'description', type: 'TEXT', description: 'Detailed item marketing & care copy' },
        { name: 'image_url', type: 'VARCHAR(500)', description: 'Verified asset reference' },
        { name: 'status', type: 'ENUM', description: "'active', 'discontinued', 'draft'" },
      ],
    },
    product_variants: {
      description: 'SKU variants tracking unique combinations of size, color, finish, and barcodes.',
      engine: 'InnoDB',
      rowCount: state.products.flatMap((p) => p.variants).length,
      columns: [
        { name: 'id', type: 'VARCHAR(36)', key: 'PRIMARY KEY', description: 'Unique variant identifier' },
        { name: 'product_id', type: 'VARCHAR(36)', key: 'FOREIGN KEY', description: 'Ref products(id) ON DELETE CASCADE' },
        { name: 'sku', type: 'VARCHAR(60)', key: 'UNIQUE', description: 'Exact scannable Stock Keeping Unit' },
        { name: 'barcode', type: 'VARCHAR(50)', key: 'UNIQUE', description: 'UPC/EAN-13 barcode sequence' },
        { name: 'variant_name', type: 'VARCHAR(120)', description: 'Human readable attribute label' },
        { name: 'attributes_json', type: 'JSON', description: 'Structured attributes (size, color, finish)' },
        { name: 'unit_cost', type: 'DECIMAL(12,4)', description: 'Standard acquisition cost' },
        { name: 'unit_price', type: 'DECIMAL(12,4)', description: 'Current retail selling price' },
        { name: 'supplier', type: 'VARCHAR(150)', description: 'Primary wholesale vendor' },
        { name: 'lead_time_days', type: 'INT', description: 'Procurement reorder lead days' },
      ],
    },
    inventory_balances: {
      description: 'Location-specific inventory levels, safety thresholds, and availability.',
      engine: 'InnoDB',
      rowCount: state.balances.length,
      columns: [
        { name: 'id', type: 'VARCHAR(36)', key: 'PRIMARY KEY', description: 'Balance record ID' },
        { name: 'sku_id', type: 'VARCHAR(36)', key: 'FOREIGN KEY', description: 'Ref product_variants(id)' },
        { name: 'location_id', type: 'VARCHAR(36)', key: 'FOREIGN KEY', description: 'Ref store_locations(id)' },
        { name: 'quantity_on_hand', type: 'INT', description: 'Physical quantity present' },
        { name: 'quantity_allocated', type: 'INT', description: 'Units reserved for orders' },
        { name: 'quantity_available', type: 'INT (VIRTUAL)', description: 'on_hand - allocated (Computed)' },
        { name: 'min_reorder_point', type: 'INT', description: 'Safety reorder threshold' },
        { name: 'max_capacity', type: 'INT', description: 'Bin/shelf maximum allocation' },
        { name: 'last_counted_at', type: 'TIMESTAMP', description: 'Timestamp of last verified cycle count' },
      ],
    },
    inventory_transactions: {
      description: 'Immutable transaction ledger recording every receipt, POS sale, return, and transfer.',
      engine: 'InnoDB',
      rowCount: state.transactions.length,
      columns: [
        { name: 'id', type: 'VARCHAR(36)', key: 'PRIMARY KEY', description: 'Ledger sequence entry' },
        { name: 'sku_id', type: 'VARCHAR(36)', key: 'FOREIGN KEY', description: 'Transacted SKU' },
        { name: 'location_id', type: 'VARCHAR(36)', key: 'FOREIGN KEY', description: 'Store or warehouse' },
        { name: 'transaction_type', type: 'ENUM', description: 'receipt, pos_sale, return, transfer, adjustment' },
        { name: 'quantity_delta', type: 'INT', description: 'Signed net change (+ or -)' },
        { name: 'balance_before', type: 'INT', description: 'Snapshot balance prior to entry' },
        { name: 'balance_after', type: 'INT', description: 'Resulting balance after entry' },
        { name: 'unit_cost', type: 'DECIMAL(12,4)', description: 'Cost basis at transaction time' },
        { name: 'total_valuation_delta', type: 'DECIMAL(14,4)', description: 'delta * unit_cost' },
        { name: 'reference_type', type: 'ENUM', description: 'PO, POS_RECEIPT, TRANSFER_ORDER, RECON_SESSION' },
        { name: 'reference_id', type: 'VARCHAR(100)', description: 'External order or slip number' },
        { name: 'performed_by_user_id', type: 'VARCHAR(36)', description: 'Staff member or automated service' },
      ],
    },
    reconciliation_sessions: {
      description: 'Physical audit sessions comparing recorded expected balances with counted stock.',
      engine: 'InnoDB',
      rowCount: state.reconciliationSessions.length,
      columns: [
        { name: 'id', type: 'VARCHAR(36)', key: 'PRIMARY KEY', description: 'Session UUID' },
        { name: 'session_code', type: 'VARCHAR(50)', key: 'UNIQUE', description: 'e.g. REC-2026-1025-A' },
        { name: 'location_id', type: 'VARCHAR(36)', key: 'FOREIGN KEY', description: 'Facility audited' },
        { name: 'status', type: 'ENUM', description: 'in_progress, pending_manager_approval, approved_posted' },
        { name: 'total_expected_units', type: 'INT', description: 'System recorded baseline' },
        { name: 'total_counted_units', type: 'INT', description: 'Physical counts entered' },
        { name: 'net_variance_units', type: 'INT', description: 'Net shortage or overage' },
        { name: 'net_variance_cost', type: 'DECIMAL(14,4)', description: 'Financial cost impact' },
        { name: 'started_by', type: 'VARCHAR(100)', description: 'Auditor or clerk name' },
        { name: 'finalized_by', type: 'VARCHAR(100)', description: 'Authorizing manager' },
      ],
    },
    audit_trail_entries: {
      description: 'Comprehensive tamper-evident forensic log of all system state modifications.',
      engine: 'InnoDB',
      rowCount: state.auditLogs.length,
      columns: [
        { name: 'id', type: 'VARCHAR(36)', key: 'PRIMARY KEY', description: 'Log entry ID' },
        { name: 'timestamp', type: 'TIMESTAMP', description: 'UTC timestamp of event' },
        { name: 'user_id', type: 'VARCHAR(36)', description: 'Actor UUID' },
        { name: 'user_role', type: 'VARCHAR(50)', description: 'Store Associate, Manager, Auditor' },
        { name: 'action', type: 'VARCHAR(100)', description: 'ACTION_CODE (e.g. POS_SALE_PROCESSED)' },
        { name: 'entity_type', type: 'VARCHAR(50)', description: 'BALANCE, TRANSACTION, RECON' },
        { name: 'entity_id', type: 'VARCHAR(60)', description: 'Target entity key' },
        { name: 'details', type: 'TEXT', description: 'Audit prose description' },
        { name: 'ip_address', type: 'VARCHAR(45)', description: 'Terminal / Client IP' },
      ],
    },
  };

  const handleRunQuery = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const result = inventoryStore.executeSqlQuery(sqlQuery);
    setQueryResult(result);
  };

  const handleDownloadDump = () => {
    const dumpText = inventoryStore.generateFullMysqlDump();
    const blob = new Blob([dumpText], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omnistock_mysql8_dump_${new Date().toISOString().slice(0, 10)}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const queryPresets = [
    {
      label: 'Low Stock Balances',
      sql: 'SELECT * FROM inventory_balances WHERE on_hand <= min_reorder_point',
    },
    {
      label: 'All Active Products & SKUs',
      sql: 'SELECT * FROM product_variants LIMIT 10',
    },
    {
      label: 'Recent Inventory Ledger Transactions',
      sql: 'SELECT * FROM inventory_transactions LIMIT 10',
    },
    {
      label: 'Reconciliation Variances & Exceptions',
      sql: 'SELECT * FROM reconciliation_items WHERE variance_units != 0',
    },
    {
      label: 'Show All MySQL Tables',
      sql: 'SHOW TABLES',
    },
    {
      label: 'Describe Inventory Balances Table',
      sql: 'DESCRIBE inventory_balances',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            MySQL 8.0 Central Database & Schema Studio
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Relational InnoDB database schema, foreign key integrity, index layout, and interactive SQL query console
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDownloadDump}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download MySQL .sql Dump</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md w-fit">
        <button
          onClick={() => setActiveTab('tables')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
            activeTab === 'tables'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Relational Table Catalog
        </button>
        <button
          onClick={() => {
            setActiveTab('query_console');
            if (!queryResult) handleRunQuery();
          }}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
            activeTab === 'query_console'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Interactive SQL Query Console
        </button>
        <button
          onClick={() => setActiveTab('ddl_code')}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
            activeTab === 'ddl_code'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Raw DDL & Stored Procedures
        </button>
      </div>

      {/* VIEW 1: TABLE CATALOG */}
      {activeTab === 'tables' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Table List Sidebar */}
          <div className="md:col-span-1 space-y-2">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2">
              Database Tables ({Object.keys(tableDefinitions).length})
            </div>
            <div className="space-y-1">
              {Object.entries(tableDefinitions).map(([tblName, def]) => (
                <button
                  key={tblName}
                  onClick={() => setSelectedTable(tblName)}
                  className={`w-full text-left px-3 py-2 text-xs rounded-lg border transition-colors flex items-center justify-between ${
                    selectedTable === tblName
                      ? 'bg-slate-900 border-slate-900 text-white font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-mono">{tblName}</span>
                  <span
                    className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
                      selectedTable === tblName ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {def.rowCount}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Table Details */}
          <div className="md:col-span-3 space-y-4">
            {tableDefinitions[selectedTable] && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 font-mono">
                      TABLE `{selectedTable}`
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {tableDefinitions[selectedTable].description}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-slate-400">Engine: </span>
                    <span className="font-semibold text-slate-700">{tableDefinitions[selectedTable].engine}</span>
                  </div>
                </div>

                {/* Columns Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600">
                        <th className="py-2 px-3 font-semibold">Column Name</th>
                        <th className="py-2 px-3 font-semibold">SQL Type</th>
                        <th className="py-2 px-3 font-semibold">Key / Constraint</th>
                        <th className="py-2 px-3 font-semibold">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {tableDefinitions[selectedTable].columns.map((col) => (
                        <tr key={col.name} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {col.name}
                          </td>
                          <td className="py-2.5 px-3 text-blue-700">
                            {col.type}
                          </td>
                          <td className="py-2.5 px-3">
                            {col.key ? (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  col.key.includes('PRIMARY')
                                    ? 'bg-amber-100 text-amber-900'
                                    : col.key.includes('FOREIGN')
                                    ? 'bg-purple-100 text-purple-900'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {col.key}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-600 text-xs">
                            {col.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setSqlQuery(`SELECT * FROM ${selectedTable} LIMIT 10`);
                      setActiveTab('query_console');
                      setTimeout(() => handleRunQuery(), 50);
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <span>Query this table in SQL console →</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: INTERACTIVE SQL QUERY CONSOLE */}
      {activeTab === 'query_console' && (
        <div className="space-y-4">
          {/* Query Presets */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-medium whitespace-nowrap">Presets:</span>
            {queryPresets.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSqlQuery(p.sql);
                  setTimeout(() => {
                    const res = inventoryStore.executeSqlQuery(p.sql);
                    setQueryResult(res);
                  }, 50);
                }}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded text-slate-700 whitespace-nowrap transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* SQL Editor Box */}
          <form onSubmit={handleRunQuery} className="bg-slate-900 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-mono text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                mysql&gt; omnistock_inventory
              </span>
              <span>Press Run Query to execute against active database</span>
            </div>

            <textarea
              rows={3}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="w-full bg-slate-950 text-emerald-300 font-mono text-xs p-3 rounded border border-slate-800 focus:outline-none focus:border-slate-700"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Supports SELECT, SHOW TABLES, and DESCRIBE syntax
              </span>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Query</span>
              </button>
            </div>
          </form>

          {/* Query Result Grid */}
          {queryResult && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                <div className="font-semibold text-slate-700">
                  Query Results: <span className="font-mono font-bold text-slate-900">{queryResult.rows.length} rows</span> returned
                </div>
                <div className="text-slate-500 font-mono text-[11px] tabular-nums">
                  Execution time: {queryResult.executionTimeMs}ms
                </div>
              </div>

              {queryResult.error ? (
                <div className="p-4 bg-rose-50 text-rose-800 text-xs font-mono">
                  ERROR: {queryResult.error}
                </div>
              ) : queryResult.rows.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Empty result set (0 rows).
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-100 z-10">
                      <tr className="border-b border-slate-200 text-slate-700 font-mono">
                        {queryResult.columns.map((col) => (
                          <th key={col} className="py-2 px-3 font-semibold uppercase text-[11px]">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {queryResult.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50">
                          {queryResult.columns.map((col) => (
                            <td key={col} className="py-2 px-3 text-slate-800 whitespace-nowrap">
                              {row[col] !== undefined ? String(row[col]) : 'NULL'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: RAW DDL & PROCEDURES */}
      {activeTab === 'ddl_code' && (
        <div className="bg-slate-900 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-slate-300 font-semibold flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-blue-400" />
              <span>src/db/mysql-schema.sql (Production MySQL 8.0 DDL)</span>
            </span>
            <button
              onClick={() => {
                const dump = inventoryStore.generateFullMysqlDump();
                navigator.clipboard.writeText(dump);
                setCopiedDdl(true);
                setTimeout(() => setCopiedDdl(false), 2000);
              }}
              className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
            >
              {copiedDdl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedDdl ? 'Copied' : 'Copy SQL'}</span>
            </button>
          </div>

          <pre className="bg-slate-950 text-slate-300 p-4 rounded text-[11px] font-mono overflow-x-auto max-h-96 leading-relaxed">
{`-- MySQL 8.0 DDL & STORED PROCEDURE DEFINITION
CREATE TABLE IF NOT EXISTS \`inventory_balances\` (
    \`id\` VARCHAR(36) PRIMARY KEY,
    \`sku_id\` VARCHAR(36) NOT NULL,
    \`location_id\` VARCHAR(36) NOT NULL,
    \`quantity_on_hand\` INT NOT NULL DEFAULT 0,
    \`quantity_allocated\` INT NOT NULL DEFAULT 0,
    \`quantity_available\` INT GENERATED ALWAYS AS (\`quantity_on_hand\` - \`quantity_allocated\`) STORED,
    \`min_reorder_point\` INT NOT NULL DEFAULT 10,
    \`max_capacity\` INT NOT NULL DEFAULT 200,
    \`last_counted_at\` TIMESTAMP NULL,
    UNIQUE KEY \`uk_sku_location\` (\`sku_id\`, \`location_id\`),
    FOREIGN KEY (\`sku_id\`) REFERENCES \`product_variants\`(\`id\`) ON DELETE RESTRICT,
    FOREIGN KEY (\`location_id\`) REFERENCES \`store_locations\`(\`id\`) ON DELETE RESTRICT
) ENGINE=InnoDB;

DELIMITER $$
CREATE PROCEDURE \`sp_finalize_reconciliation\`(
    IN in_session_id VARCHAR(36),
    IN in_manager_id VARCHAR(36),
    IN in_manager_notes TEXT
)
BEGIN
    START TRANSACTION;
    -- Iterates through variance items, posts adjustment transactions,
    -- updates live inventory balances, and marks session approved_posted
    COMMIT;
END$$
DELIMITER ;`}
          </pre>
        </div>
      )}
    </div>
  );
};
