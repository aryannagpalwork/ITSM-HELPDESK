import React, { useEffect, useState } from 'react';
import { useApp } from '../../shared/AppContext';
import { extractApiError } from '../../shared/api';
import {
  ShieldCheck,
  Users,
  AlertOctagon,
  CheckCircle,
  XCircle,
  RefreshCw,
  UserPlus,
  UserCheck,
  UserX,
  Activity,
  Search,
  ToggleLeft,
  ToggleRight,
  Edit3,
  Trash2,
  UserCog,
  Plus,
  X,
  Copy,
  Check,
} from 'lucide-react';

type UserTab = 'pending' | 'active' | 'inactive' | 'all';

interface UserEntry {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  is_active: boolean;
  createdAt: string;
  departmentId?: string;
  specialization?: string | string[] | null;
}

interface ModalState {
  type: 'create' | 'edit' | 'delete' | 'change-role' | null;
  user: UserEntry | null;
}

export const AdminPendingUsers: React.FC = () => {
  const {
    currentUser,
    pendingUsers,
    allUsers,
    usersLoading,
    usersError,
    approvePendingUser,
    rejectPendingUser,
    activatePendingUser,
    deactivatePendingUser,
    loadPendingUsers,
    loadAllUsers,
    createUser,
    updateUser,
    deleteUser,
    changeUserRole,
  } = useApp();
  const [activeTab, setActiveTab] = useState<UserTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [modal, setModal] = useState<ModalState>({ type: null, user: null });

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('employee');
  const [formDepartment, setFormDepartment] = useState('');
  const [formSpecializations, setFormSpecializations] = useState<string[]>([]);
  const [formSpecInput, setFormSpecInput] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPasswordAutoGen, setFormPasswordAutoGen] = useState(true);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const isAuthorized = currentUser.role === 'Administrator';

  useEffect(() => {
    if (isAuthorized) {
      loadPendingUsers();
      loadAllUsers(showDeleted);
    }
  }, [isAuthorized]);

  // Refetch all users when showDeleted changes
  useEffect(() => {
    if (isAuthorized) {
      loadAllUsers(showDeleted);
    }
  }, [isAuthorized, showDeleted]);

const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormRole('employee');
    setFormDepartment('');
    setFormSpecializations([]);
    setFormSpecInput('');
    setFormPassword('');
    setFormPasswordAutoGen(true);
    setFormError('');
    setFormLoading(false);
  };

  const openCreateModal = () => {
    resetForm();
    setModal({ type: 'create', user: null });
  };

  const openEditModal = (user: UserEntry) => {
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role.toLowerCase() === 'administrator' ? 'admin' : user.role.toLowerCase());
    setFormDepartment(user.departmentId || '');
    const existingSpec = user.specialization;
    if (Array.isArray(existingSpec)) {
      setFormSpecializations(existingSpec);
    } else if (typeof existingSpec === 'string' && existingSpec) {
      setFormSpecializations([existingSpec]);
    } else {
      setFormSpecializations([]);
    }
    setFormSpecInput('');
    setFormError('');
    setFormLoading(false);
    setModal({ type: 'edit', user });
  };

  const openDeleteModal = (user: UserEntry) => {
    setModal({ type: 'delete', user });
  };

  const openChangeRoleModal = (user: UserEntry) => {
    setFormRole(user.role.toLowerCase() === 'administrator' ? 'admin' : user.role.toLowerCase());
    setFormError('');
    setFormLoading(false);
    setModal({ type: 'change-role', user });
  };

  const closeModal = () => {
    setModal({ type: null, user: null });
    resetForm();
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      setFormError('Name and email are required.');
      return;
    }
    if (!formPasswordAutoGen && !formPassword.trim()) {
      setFormError('Password is required when manual password entry is selected.');
      return;
    }
    setFormLoading(true);
    try {
      const generatedPassword = await createUser(
        formName.trim(),
        formEmail.trim(),
        formRole,
        formDepartment.trim() || undefined,
        formPasswordAutoGen ? undefined : formPassword.trim(),
        formRole === 'agent' && formSpecializations.length ? formSpecializations : undefined
      );
      closeModal();
      setCreatedCredentials({ email: formEmail.trim(), password: generatedPassword });
    } catch (err: unknown) {
      setFormError(extractApiError(err) || 'Failed to create user.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!modal.user) return;
    if (!formName.trim()) {
      setFormError('Name is required.');
      return;
    }
    setFormLoading(true);
    try {
      await updateUser(
        modal.user.id,
        formName.trim() || undefined,
        formDepartment.trim() || undefined,
        formRole || undefined,
        formRole === 'agent' ? formSpecializations : undefined
      );
      closeModal();
    } catch (err: unknown) {
      setFormError(extractApiError(err) || 'Failed to update user.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!modal.user) return;
    setFormLoading(true);
    try {
      await deleteUser(modal.user.id);
      closeModal();
    } catch (err: unknown) {
      setFormError(extractApiError(err) || 'Failed to delete user.');
      setFormLoading(false);
    }
  };

  const handleChangeRole = async () => {
    if (!modal.user) return;
    setFormLoading(true);
    try {
      await changeUserRole(modal.user.id, formRole);
      closeModal();
    } catch (err: unknown) {
      setFormError(extractApiError(err) || 'Failed to change role.');
    } finally {
      setFormLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex-1 bg-app p-8 flex flex-col items-center justify-center h-full font-sans">
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl mb-4">
          <AlertOctagon className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-sm font-bold text-primary">Administrative Security Shield</h2>
        <p className="text-xs text-tertiary mt-2 max-w-sm text-center leading-relaxed">
          Access denied. This console requires Administrator authorization credentials.
        </p>
      </div>
    );
  }

  const pendingList = pendingUsers;
  const activeList = allUsers.filter(u => u.status === 'APPROVED' && u.is_active);
  const inactiveList = allUsers.filter(u => u.status === 'INACTIVE' || u.status === 'DISABLED' || u.status === 'REJECTED' || (!u.is_active && u.status !== 'PENDING'));

  const getFilteredUsers = () => {
    let list: typeof allUsers = [];

    switch (activeTab) {
      case 'pending':
        list = pendingList.map(u => ({ ...u, is_active: false }));
        break;
      case 'active':
        list = activeList;
        break;
      case 'inactive':
        list = inactiveList;
        break;
      case 'all':
        list = allUsers;
        break;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.status.toLowerCase().includes(q)
      );
    }

    return list;
  };

  const filteredUsers = getFilteredUsers();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span>;
      case 'APPROVED':
        return <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>;
      case 'REJECTED':
        return <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">Rejected</span>;
      case 'INACTIVE':
        return <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">Inactive</span>;
      case 'DISABLED':
        return <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold bg-red-500/10 text-red-400 border border-red-500/20">Disabled</span>;
      default:
        return <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">{status}</span>;
    }
  };

  const tabs: { key: UserTab; label: string; count: number; icon: React.ElementType }[] = [
    { key: 'pending', label: 'Pending Approval', count: pendingList.length, icon: UserPlus },
    { key: 'active', label: 'Active Users', count: activeList.length, icon: UserCheck },
    { key: 'inactive', label: 'Inactive Users', count: inactiveList.length, icon: UserX },
    { key: 'all', label: 'All Users', count: allUsers.length, icon: Users },
  ];

  return (
    <div className="flex-1 bg-app p-8 overflow-y-auto h-full font-sans">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-tertiary flex items-center gap-1.5 font-semibold">
            <Activity className="w-3.5 h-3.5 text-rose-500" />
            <span>User Administration</span>
          </span>
          <h1 className="text-2xl font-bold text-primary tracking-tight">User Management</h1>
          <p className="text-xs text-secondary">
            Create, edit, activate, deactivate, delete users and manage roles across the enterprise.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <button
            onClick={openCreateModal}
            className="px-4 py-2 accent-btn rounded-lg text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create User</span>
          </button>
          <button
            onClick={() => { loadPendingUsers(); loadAllUsers(); }}
            className="p-2 bg-card-solid border border-token rounded-lg hover-elev transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-secondary" />
          </button>
          <div className="p-2 bg-card-solid border border-token rounded-lg text-secondary font-mono flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>System Online</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
                isActive
                  ? 'bg-card-solid text-primary border-token-strong shadow-sm'
                  : 'text-secondary hover-text hover-elev border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-accent' : 'text-tertiary'}`} />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold ${
                isActive
                  ? 'bg-hover text-secondary'
                  : 'bg-card text-tertiary'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + Show Deleted Toggle */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
          <input
            type="text"
            placeholder="Search by name, email, role or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full input-token rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none"
          />
        </div>
        <label className="flex items-center gap-2 px-3 py-2 bg-card border border-token rounded-xl cursor-pointer hover-border transition-colors">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-indigo-500"
          />
          <span className="text-[10px] font-mono text-secondary">Show Deleted</span>
        </label>
      </div>

      {/* Loading State */}
      {usersLoading && (
        <div className="bg-card border border-token rounded-2xl p-12 text-center">
          <RefreshCw className="w-6 h-6 text-tertiary mx-auto mb-3 animate-spin" />
          <p className="text-xs text-secondary">Loading users...</p>
        </div>
      )}

      {/* Error State */}
      {!usersLoading && usersError && (
        <div className="bg-card border border-rose-500/20 rounded-2xl p-12 text-center">
          <AlertOctagon className="w-6 h-6 text-rose-400 mx-auto mb-3" />
          <p className="text-xs text-secondary mb-2">Failed to load users</p>
          <p className="text-[10px] text-tertiary mb-4">{usersError}</p>
          <button
            onClick={() => { loadPendingUsers(); loadAllUsers(showDeleted); }}
            className="px-4 py-2 bg-card-solid hover-elev text-secondary rounded-lg text-[10px] font-semibold transition-all"
          >
            Retry
          </button>
        </div>
      )}

{/* Users Table */}
      {!usersLoading && !usersError && (
        <>
          {filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-8 h-8 text-tertiary mx-auto mb-3" />
            <p className="text-sm font-semibold text-secondary">No users found</p>
            <p className="text-[10px] text-tertiary mt-1">
              {activeTab === 'pending'
                ? 'All pending registrations have been processed.'
                : 'No users match your current filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-token">
                  <th className="text-left px-5 py-3.5 text-[10px] font-mono uppercase tracking-wider text-tertiary font-semibold">User</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-mono uppercase tracking-wider text-tertiary font-semibold">Email</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-mono uppercase tracking-wider text-tertiary font-semibold">Role</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-mono uppercase tracking-wider text-tertiary font-semibold">Status</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-mono uppercase tracking-wider text-tertiary font-semibold">Registered</th>
                  <th className="text-right px-5 py-3.5 text-[10px] font-mono uppercase tracking-wider text-tertiary font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-token">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover-elev transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent-soft border border-token rounded-lg shrink-0">
                          <Users className="w-4 h-4 text-accent" />
                        </div>
                        <span className="text-xs font-semibold text-primary">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[11px] text-secondary">{user.email}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] font-mono text-secondary">{user.role}</span>
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] text-tertiary font-mono">
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {user.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => approvePendingUser(user.id)}
                              className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all"
                            >
                              <CheckCircle className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => rejectPendingUser(user.id)}
                              className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                        {user.status === 'APPROVED' && user.is_active && (
                          <button
                            onClick={() => deactivatePendingUser(user.id)}
                            className="px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 text-orange-400 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all"
                          >
                            <ToggleRight className="w-3 h-3" />
                            <span>Deactivate</span>
                          </button>
                        )}
                        {(user.status === 'INACTIVE' || user.status === 'DISABLED' || user.status === 'REJECTED' || (user.status === 'APPROVED' && !user.is_active)) && (
                          <button
                            onClick={() => activatePendingUser(user.id)}
                            className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all"
                          >
                            <ToggleLeft className="w-3 h-3" />
                            <span>Activate</span>
                          </button>
                        )}
                        {user.status !== 'PENDING' && (
                          <>
                            <button
                              onClick={() => openEditModal(user)}
                              className="px-2 py-1.5 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 text-blue-400 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all"
                              title="Edit user"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => openChangeRoleModal(user)}
                              className="px-2 py-1.5 bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 text-violet-400 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all"
                              title="Change role"
                            >
                              <UserCog className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        {user.id !== currentUser.id && (
                          <button
                            onClick={() => openDeleteModal(user)}
                            className="px-2 py-1.5 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all"
                            title="Delete user"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
      )}

      <div className="mt-6 p-4 bg-card border border-token rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-tertiary">
          <Users className="w-3.5 h-3.5" />
          <span>
            Showing <strong className="text-secondary">{filteredUsers.length}</strong> of{' '}
            <strong className="text-secondary">{allUsers.length}</strong> total users
          </span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-tertiary">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            {pendingList.length} Pending
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {activeList.length} Active
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
            {inactiveList.length} Inactive
          </span>
        </div>
      </div>

      {/* ─── MODALS ─── */}
      {modal.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card-solid border border-token-strong rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {modal.type === 'create' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-bold text-primary">Create New User</h3>
                  </div>
                  <button onClick={closeModal} className="p-1 hover-elev rounded-lg transition-colors">
                    <X className="w-4 h-4 text-secondary" />
                  </button>
                </div>
                {formError && (
                  <div className="mb-4 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] text-rose-400">{formError}</div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">Email</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none"
                      placeholder="john@enterprise.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">Role</label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none"
                    >
                      <option value="employee">Employee</option>
                      <option value="agent">Agent</option>
                    </select>
                  </div>
<div>
                    <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">Department (optional)</label>
                    <input
                      type="text"
                      value={formDepartment}
                      onChange={(e) => setFormDepartment(e.target.value)}
                      className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none"
                      placeholder="Engineering"
                    />
                  </div>
                  {formRole === 'agent' && (
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">Specialization (optional)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formSpecInput}
                          onChange={(e) => setFormSpecInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = formSpecInput.trim(); if (v && !formSpecializations.includes(v)) setFormSpecializations([...formSpecializations, v]); setFormSpecInput(''); } }}
                          className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none"
                          placeholder="e.g. Network, Hardware"
                        />
                        <button
                          type="button"
                          onClick={() => { const v = formSpecInput.trim(); if (v && !formSpecializations.includes(v)) setFormSpecializations([...formSpecializations, v]); setFormSpecInput(''); }}
                          className="px-3 py-2 bg-accent/10 border border-accent/30 text-accent rounded-lg text-[10px] font-semibold hover:bg-accent/20 transition-all"
                        >
                          Add
                        </button>
                      </div>
                      {formSpecializations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {formSpecializations.map(spec => (
                            <span key={spec} className="inline-flex items-center gap-1 text-[9px] px-2 py-1 rounded-full bg-accent-soft text-accent border border-token font-medium">
                              {spec}
                              <button type="button" onClick={() => setFormSpecializations(formSpecializations.filter(s => s !== spec))} className="hover:opacity-70">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Password Field */}
                  <div className="border-t border-token pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-[10px] font-mono uppercase text-tertiary">Password</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPasswordAutoGen}
                          onChange={(e) => {
                            setFormPasswordAutoGen(e.target.checked);
                            if (e.target.checked) setFormPassword('');
                          }}
                          className="w-3 h-3 rounded accent-indigo-500"
                        />
                        <span className="text-[9px] font-mono text-tertiary">Auto-generate</span>
                      </label>
                    </div>
                    {!formPasswordAutoGen && (
                      <input
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none"
                        placeholder="Enter a secure password"
                      />
                    )}
                    {formPasswordAutoGen && (
                      <p className="text-[9px] text-tertiary font-mono">A secure random password will be generated automatically.</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={closeModal} className="px-4 py-2 bg-card hover-elev text-secondary rounded-lg text-[10px] font-semibold transition-all">Cancel</button>
                  <button
                    onClick={handleCreate}
                    disabled={formLoading}
                    className="px-4 py-2 accent-btn disabled:opacity-50 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all"
                  >
                    {formLoading ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </div>
            )}

            {modal.type === 'edit' && modal.user && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-primary">Edit User</h3>
                  </div>
                  <button onClick={closeModal} className="p-1 hover-elev rounded-lg transition-colors">
                    <X className="w-4 h-4 text-secondary" />
                  </button>
                </div>
                {formError && (
                  <div className="mb-4 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] text-rose-400">{formError}</div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">Full Name</label>
                    <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">Email (read-only)</label>
                    <input type="email" value={formEmail} readOnly className="w-full bg-input border border-token rounded-lg px-3 py-2 text-xs text-tertiary outline-none cursor-not-allowed opacity-70" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">Role</label>
                    <select value={formRole} onChange={(e) => setFormRole(e.target.value)} className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none">
                      <option value="employee">Employee</option>
                      <option value="agent">Agent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">Department</label>
                    <input type="text" value={formDepartment} onChange={(e) => setFormDepartment(e.target.value)} className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none" />
                  </div>
                  {formRole === 'agent' && (
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">Specialization</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formSpecInput}
                          onChange={(e) => setFormSpecInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = formSpecInput.trim(); if (v && !formSpecializations.includes(v)) setFormSpecializations([...formSpecializations, v]); setFormSpecInput(''); } }}
                          className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none"
                          placeholder="e.g. Network, Hardware"
                        />
                        <button
                          type="button"
                          onClick={() => { const v = formSpecInput.trim(); if (v && !formSpecializations.includes(v)) setFormSpecializations([...formSpecializations, v]); setFormSpecInput(''); }}
                          className="px-3 py-2 bg-accent/10 border border-accent/30 text-accent rounded-lg text-[10px] font-semibold hover:bg-accent/20 transition-all"
                        >
                          Add
                        </button>
                      </div>
                      {formSpecializations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {formSpecializations.map(spec => (
                            <span key={spec} className="inline-flex items-center gap-1 text-[9px] px-2 py-1 rounded-full bg-accent-soft text-accent border border-token font-medium">
                              {spec}
                              <button type="button" onClick={() => setFormSpecializations(formSpecializations.filter(s => s !== spec))} className="hover:opacity-70">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={closeModal} className="px-4 py-2 bg-card hover-elev text-secondary rounded-lg text-[10px] font-semibold transition-all">Cancel</button>
                  <button onClick={handleEdit} disabled={formLoading} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-semibold transition-all">{formLoading ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </div>
            )}

            {modal.type === 'delete' && modal.user && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <h3 className="text-sm font-bold text-primary">Delete User</h3>
                  </div>
                  <button onClick={closeModal} className="p-1 hover-elev rounded-lg transition-colors">
                    <X className="w-4 h-4 text-secondary" />
                  </button>
                </div>
                {formError && (
                  <div className="mb-4 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] text-rose-400">{formError}</div>
                )}
                <div className="p-4 bg-card border border-token rounded-xl mb-4">
                  <p className="text-xs text-primary font-semibold">{modal.user.name}</p>
                  <p className="text-[10px] text-tertiary">{modal.user.email}</p>
                </div>
                <p className="text-xs text-secondary mb-2">Are you sure you want to delete this user? This action performs a soft delete.</p>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={closeModal} className="px-4 py-2 bg-card hover-elev text-secondary rounded-lg text-[10px] font-semibold transition-all">Cancel</button>
                  <button onClick={handleDelete} disabled={formLoading} className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-semibold transition-all">{formLoading ? 'Deleting...' : 'Delete User'}</button>
                </div>
              </div>
            )}

            {modal.type === 'change-role' && modal.user && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <UserCog className="w-4 h-4 text-violet-400" />
                    <h3 className="text-sm font-bold text-primary">Change User Role</h3>
                  </div>
                  <button onClick={closeModal} className="p-1 hover-elev rounded-lg transition-colors">
                    <X className="w-4 h-4 text-secondary" />
                  </button>
                </div>
                {formError && (
                  <div className="mb-4 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] text-rose-400">{formError}</div>
                )}
                <div className="p-4 bg-card border border-token rounded-xl mb-4">
                  <p className="text-xs text-primary font-semibold">{modal.user.name}</p>
                  <p className="text-[10px] text-tertiary">Current role: {modal.user.role}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-tertiary mb-1.5">New Role</label>
                  <select value={formRole} onChange={(e) => setFormRole(e.target.value)} className="w-full input-token rounded-lg px-3 py-2 text-xs outline-none">
                    <option value="admin">Administrator</option>
                    <option value="agent">Agent</option>
                    <option value="end_user">Employee</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={closeModal} className="px-4 py-2 bg-card hover-elev text-secondary rounded-lg text-[10px] font-semibold transition-all">Cancel</button>
                  <button onClick={handleChangeRole} disabled={formLoading} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-semibold transition-all">{formLoading ? 'Updating...' : 'Change Role'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {createdCredentials && (
        <CredentialSuccessModal
          email={createdCredentials.email}
          password={createdCredentials.password}
          onClose={() => setCreatedCredentials(null)}
        />
      )}
    </div>
  );
};

const CredentialSuccessModal: React.FC<{
  email: string;
  password: string;
  onClose: () => void;
}> = ({ email, password, onClose }) => {
  const [copied, setCopied] = useState<'email' | 'password' | 'all' | null>(null);
  const credentials = `Email: ${email}\nPassword: ${password}`;

  const copy = async (value: string, target: 'email' | 'password' | 'all') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.setTimeout(() => setCopied(current => current === target ? null : current), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-token-strong bg-card-solid shadow-2xl">
        <div className="flex items-start justify-between border-b border-token px-6 py-5">
          <div>
            <h3 className="text-sm font-bold text-primary">User created successfully</h3>
            <p className="mt-1 text-[11px] text-secondary">Copy and securely share these credentials with the user.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover-elev" aria-label="Close credential dialog">
            <X className="h-4 w-4 text-secondary" />
          </button>
        </div>
        <div className="space-y-3 p-6">
          <CredentialRow label="Email" value={email} copied={copied === 'email'} onCopy={() => copy(email, 'email')} />
          <CredentialRow label="Password" value={password} copied={copied === 'password'} onCopy={() => copy(password, 'password')} />
          <button type="button" onClick={() => copy(credentials, 'all')} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-token px-3 py-2 text-[11px] font-semibold text-secondary transition-colors hover-elev">
            {copied === 'all' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === 'all' ? 'Copied credentials' : 'Copy all credentials'}
          </button>
        </div>
        <div className="flex justify-end border-t border-token px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg accent-btn px-4 py-2 text-xs font-semibold">Done</button>
        </div>
      </div>
    </div>
  );
};

const CredentialRow: React.FC<{
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}> = ({ label, value, copied, onCopy }) => (
  <div className="flex items-center gap-3 rounded-xl border border-token bg-card px-3 py-2.5">
    <div className="min-w-0 flex-1">
      <p className="text-[9px] font-mono uppercase tracking-wider text-tertiary">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-primary select-text">{value}</p>
    </div>
    <button type="button" onClick={onCopy} className="shrink-0 rounded-lg border border-token p-2 text-secondary hover-elev" aria-label={`Copy ${label}`}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  </div>
);
