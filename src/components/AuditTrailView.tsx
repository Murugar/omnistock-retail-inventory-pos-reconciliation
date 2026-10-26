import React, { useState } from 'react';
import { AppState } from '../services/inventoryStore';
import { 
  ShieldCheck, 
  Lock, 
  Search, 
  Filter, 
  Clock, 
  Terminal, 
  UserCheck, 
  Layers 
} from 'lucide-react';

interface AuditTrailViewProps {
  state: AppState;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ state }) => {
  const { auditLogs, currentUser } = state;
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const filteredLogs = auditLogs.filter((log) => {
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      log.userName.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.entityId.toLowerCase().includes(q);

    return matchesAction && matchesSearch;
  });

  const permissionsMatrix = [
    {
      feature: 'Record Physical Counts & Scan Barcodes',
      associate: true,
      manager: true,
      director: true,
      auditor: true,
    },
    {
      feature: 'Receive Purchase Orders & Intake Stock',
      associate: false,
      manager: true,
      director: true,
      auditor: false,
    },
    {
      feature: 'Dispatch Inter-Store Facility Transfers',
      associate: false,
      manager: true,
      director: true,
      auditor: false,
    },
    {
      feature: 'Authorize & Finalize Reconciliation Adjustments',
      associate: false,
      manager: true,
      director: true,
      auditor: true,
    },
    {
      feature: 'Manual Inventory Balance Overrides',
      associate: false,
      manager: true,
      director: true,
      auditor: false,
    },
    {
      feature: 'Connect / Reconfigure POS Gateways & Webhooks',
      associate: false,
      manager: true,
      director: true,
      auditor: false,
    },
    {
      feature: 'Export Full Database DDL & SQL Dump',
      associate: false,
      manager: false,
      director: true,
      auditor: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Security, Permissions & Forensic Audit Trail
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Tamper-evident system activity ledger, role-based access control (RBAC), and user authorization logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-600 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Active Role: </span>
            <span className="font-semibold text-slate-900 capitalize">
              {currentUser.role.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Role-Based Access Control (RBAC) Governance Matrix */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>Role-Based Access Control (RBAC) Governance Matrix</span>
        </h2>
        <p className="text-xs text-slate-500">
          Enforces separation of duties so floor staff cannot unilaterally write off inventory without management review
        </p>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-2 px-3 font-semibold">System Capability</th>
                <th className="py-2 px-3 font-semibold text-center">Store Associate</th>
                <th className="py-2 px-3 font-semibold text-center">Store Manager</th>
                <th className="py-2 px-3 font-semibold text-center">Operations Director</th>
                <th className="py-2 px-3 font-semibold text-center">Inventory Auditor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permissionsMatrix.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-medium text-slate-800">
                    {row.feature}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-block font-bold text-xs ${row.associate ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {row.associate ? '✓ Granted' : '—'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-block font-bold text-xs ${row.manager ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {row.manager ? '✓ Granted' : '—'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-block font-bold text-xs ${row.director ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {row.director ? '✓ Granted' : '—'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-block font-bold text-xs ${row.auditor ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {row.auditor ? '✓ Granted' : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forensic Audit Log Search & Filter */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit trail by actor, action type, entity ID, or keyword..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md shrink-0 overflow-x-auto">
          {[
            { id: 'all', label: 'All Events' },
            { id: 'POS_SALE_PROCESSED', label: 'POS Sales' },
            { id: 'RECONCILIATION_APPROVED_AND_POSTED', label: 'Reconciliations' },
            { id: 'INTER_STORE_TRANSFER_EXECUTED', label: 'Transfers' },
            { id: 'PURCHASE_ORDER_RECEIVED', label: 'PO Receipts' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActionFilter(item.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                actionFilter === item.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Immutable Audit Trail Activity
          </h3>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {filteredLogs.length} audit records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-4 font-semibold">Timestamp (UTC)</th>
                <th className="py-2.5 px-4 font-semibold">Actor / Role</th>
                <th className="py-2.5 px-4 font-semibold">Action Trigger</th>
                <th className="py-2.5 px-4 font-semibold">Entity Ref</th>
                <th className="py-2.5 px-4 font-semibold">Forensic Description</th>
                <th className="py-2.5 px-4 font-semibold">Terminal Stamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-semibold text-slate-900">{entry.userName}</div>
                    <div className="text-[10px] text-slate-400 capitalize">
                      {entry.userRole.replace(/_/g, ' ')}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-mono font-bold text-[11px] text-blue-700">
                      {entry.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                    <span className="text-slate-400">{entry.entityType}:</span> {entry.entityId}
                  </td>
                  <td className="py-3 px-4 text-slate-600 text-xs">
                    {entry.details}
                  </td>
                  <td className="py-3 px-4 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                    {entry.ipAddress}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
