import React, { useState } from 'react';
import { User, StoreLocation } from '../types/inventory';
import { INITIAL_USERS } from '../data/mockSeed';
import { inventoryStore } from '../services/inventoryStore';
import { 
  Building2, 
  ChevronDown, 
  RotateCcw, 
  ShieldCheck, 
  UserCheck 
} from 'lucide-react';

export type ActiveTab = 
  | 'dashboard'
  | 'inventory'
  | 'transactions'
  | 'pos'
  | 'reconciliation'
  | 'mysql_studio'
  | 'audit';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: User;
  locations: StoreLocation[];
  selectedLocationId: string;
  onLocationChange: (locId: string) => void;
  onResetDb: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  locations,
  selectedLocationId,
  onLocationChange,
  onResetDb,
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'inventory', label: 'Central Inventory' },
    { id: 'transactions', label: 'Transactions & Receipts' },
    { id: 'pos', label: 'POS Integrations' },
    { id: 'reconciliation', label: 'Count & Reconcile' },
    { id: 'mysql_studio', label: 'MySQL Schema & SQL' },
    { id: 'audit', label: 'Audit Trail' },
  ];

  const roleLabels: Record<User['role'], string> = {
    store_associate: 'Store Associate',
    store_manager: 'Store Manager',
    operations_director: 'Operations Director',
    inventory_auditor: 'Inventory Auditor',
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 h-16">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="text-left group cursor-pointer focus:outline-none"
            >
              <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors whitespace-nowrap">
                OmniStock
              </span>
            </button>

            {/* Quick Location Context Picker */}
            <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-slate-200 text-xs text-slate-600">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                aria-label="Filter by Store Location"
                value={selectedLocationId}
                onChange={(e) => onLocationChange(e.target.value)}
                className="bg-transparent font-medium text-slate-700 hover:text-slate-900 cursor-pointer focus:outline-none pr-1 py-1"
              >
                <option value="all">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Role Switcher */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Role Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                title="Switch active user role to test permissions"
              >
                <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-200 shrink-0 border border-slate-300">
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80';
                    }}
                  />
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    {roleLabels[currentUser.role]}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showRoleMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Switch Authenticated Role
                  </div>
                  {INITIAL_USERS.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        inventoryStore.setCurrentUser(user);
                        setShowRoleMenu(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50 ${
                        currentUser.id === user.id ? 'bg-slate-50 font-semibold text-blue-600' : 'text-slate-700'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-slate-900">{user.name}</div>
                        <div className="text-[10px] text-slate-500">{roleLabels[user.role]}</div>
                      </div>
                      {currentUser.id === user.id && (
                        <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                      )}
                    </button>
                  ))}
                  <div className="border-t border-slate-100 mt-1 pt-1 px-2">
                    <button
                      onClick={() => {
                        setShowResetConfirm(true);
                        setShowRoleMenu(false);
                      }}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Database to Defaults
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="lg:hidden flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-100">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Database Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 border border-slate-200 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Reset Demo Database?</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              This will restore all products, SKU variations, inventory balances, POS syncs, and reconciliation records back to clean initial demo values.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onResetDb();
                  setShowResetConfirm(false);
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
