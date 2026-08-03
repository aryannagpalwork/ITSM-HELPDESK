import React, { useEffect, useState } from 'react';
import { useApp } from '../shared/AppContext';
import { extractApiError } from '../shared/api';
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
  const [modal, setModal] = useState<ModalState>({ type: null, user: null });

  // Form state for create/edit modals
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('employee');
  const [formDepartment, setFormDepartment] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const isAuthorized = currentUser.role === 'Administrator';

  useEffect(() => {
    if (isAuthorized) {
      loadPendingUsers();
      loadAllUsers();
    }
  }, [isAuthorized]);

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormRole('employee');
    setFormDepartment('');
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
    setFormLoading(true);
    try {
      const generatedPassword = await createUser(formName.trim(), formEmail.trim(), formRole, formDepartment.trim() || undefined);
      closeModal();
      // Show success alert with the generated password
      setTimeout(() => {
        alert(`User created successfully!\n\nEmail: ${formEmail.trim()}\nPassword: ${generatedPassword}\n\nPlease share these credentials with the user.`);
      }, 300);
    } catch (err: unknown) {
      setFormError(extractApiError(err));
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
        formRole || undefined
      );
      closeModal();
    } catch (err: unknown) {
      setFormError(extractApiError(err));
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
      setFormError(extractApiError(err));
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
      setFormError(extractApiError(err));
    } finally {
      setFormLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex-1 bg-zinc-950 p-8 flex flex-col items-center justify-center h-screen font-sans">
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl mb-4">
          <AlertOctagon className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-sm font-bold text-white">Administrative Security Shield</h2>
        <p className="text-xs text-zinc-500 mt-2 max-w-sm text-center leading-relaxed">
          Access denied. This console requires **Administrator** authorization credentials.
        </p>
        <div className="mt-8 p-4 bg-zinc-900 border border-zinc-800 rounded-xl max-w-sm text-center">
          <p className="text-[10px] text-zinc-400 font-mono">DEMO SHORTCUT</p>
          <div className="mt-3.5 w-full py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-semibold text-zinc-400 flex items-center justify-center space-x-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Administrator Access Required</span>
          </div>
        </div>
      </div>
    );
  }

  // Derive user lists based on status
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
    <div className="flex-1 bg-zinc-950 p-8 overflow-y-auto h-screen font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-500 flex items-center gap-1.5 font-semibold">
            <Activity className="w-3.5 h-3.5 text-rose-500" />
            <span>User Administration</span>
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">User Management</h1>
          <p className="text-xs text-zinc-400">
            Create, edit, activate, deactivate, delete users and manage roles across the enterprise.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create User</span>
          </button>
          <button
            onClick={() => { loadPendingUsers(); loadAllUsers(); }}
            className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-zinc-400" />
          </button>
          <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 font-mono flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>System Online</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-zinc-900 text-white border border-zinc-700 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${activeTab === tab.key ? 'text-indigo-400' : 'text-zinc-500'}`} />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold ${
                activeTab === tab.key
                  ? 'bg-zinc-800 text-zinc-300'
                  : 'bg-zinc-900 text-zinc-500'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search by name, email, role or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-indigo-500/50 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none placeholder-zinc-500"
        />
      </div>

      {/* Users Table */}
      <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-zinc-400">No users found</p>
            <p className="text-[10px] text-zinc-500 mt-1">
              {activeTab === 'pending'
                ? 'All pending registrations have been processed.'
                : 'No users match your current filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800/80">
                  <th className="text-left px-5 py-3.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">User</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">Email</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">Role</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">Status</th>
                  <th className="text-left px-5 py-3.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">Registered</th>
                  <th className="text-right px-5 py-3.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg shrink-0">
                          <Users className="w-4 h-4 text-indigo-400" />
                        </div>
                        <span className="text-xs font-semibold text-zinc-200">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[11px] text-zinc-400">{user.email}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] font-mono text-zinc-400">{user.role}</span>
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {/* Status-based approve/reject/activate/deactivate */}
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

                        {/* Edit & Change Role - show for all non-pending users */}
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

                        {/* Delete - allow for non-self, non-pending */}
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
      </div>

      {/* Summary Footer */}
      <div className="mt-6 p-4 bg-zinc-900/30 border border-zinc-900 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <Users className="w-3.5 h-3.5" />
          <span>
            Showing <strong className="text-zinc-300">{filteredUsers.length}</strong> of{' '}
            <strong className="text-zinc-300">{allUsers.length}</strong> total users
          </span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-zinc-500">
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

      {/* Overlay */}
      {modal.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Create Modal */}
            {modal.type === 'create' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">Create New User</h3>
                  </div>
                  <button onClick={closeModal} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
                {formError && (
                  <div className="mb-4 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] text-rose-400">{formError}</div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-zinc-800/60 border border-zinc-700 focus:border-indigo-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none placeholder-zinc-500"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full bg-zinc-800/60 border border-zinc-700 focus:border-indigo-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none placeholder-zinc-500"
                      placeholder="john@enterprise.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5">Role</label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full bg-zinc-800/60 border border-zinc-700 focus:border-indigo-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="employee">Employee</option>
                      <option value="agent">Agent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5">Department (optional)</label>
                    <input
                      type="text"
                      value={formDepartment}
                      onChange={(e) => setFormDepartment(e.target.value)}
                      className="w-full bg-zinc-800/60 border border-zinc-700 focus:border-indigo-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none placeholder-zinc-500"
                      placeholder="Engineering"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={closeModal} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-[10px] font-semibold transition-all">
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={formLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all"
                  >
                    {formLoading ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </div>
            )}

            {/* Edit Modal */}
            {modal.type === 'edit' && modal.user && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-white">Edit User</h3>
                  </div>
                  <button onClick={closeModal} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
                {formError && (
                  <div className="mb-4 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] text-rose-400">{formError}</div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-zinc-800/60 border border-zinc-700 focus:border-indigo-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5">Email (read-only)</label>
                    <input
                      type="email"
                      value={formEmail}
                      readOnly
                      className="w-full bg-zinc-800/30 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-zinc-500 outline-none cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5">Role</label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full bg-zinc-800/60 border border-zinc-700 focus:border-indigo-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="employee">Employee</option>
                      <option value="agent">Agent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5">Department</label>
                    <input
                      type="text"
                      value={formDepartment}
                      onChange={(e) => setFormDepartment(e.target.value)}
                      className="w-full bg-zinc-800/60 border border-zinc-700 focus:border-indigo-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={closeModal} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-[10px] font-semibold transition-all">
                    Cancel
                  </button>
                  <button
                    onClick={handleEdit}
                    disabled={formLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-semibold transition-all"
                  >
                    {formLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {modal.type === 'delete' && modal.user && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <h3 className="text-sm font-bold text-white">Delete User</h3>
                  </div>
                  <button onClick={closeModal} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
                {formError && (
                  <div className="mb-4 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] text-rose-400">{formError}</div>
                )}
                <div className="p-4 bg-zinc-800/40 border border-zinc-700/50 rounded-xl mb-4">
                  <p className="text-xs text-zinc-300 font-semibold">{modal.user.name}</p>
                  <p className="text-[10px] text-zinc-500">{modal.user.email}</p>
                </div>
                <p className="text-xs text-zinc-400 mb-2">
                  Are you sure you want to delete this user? This action performs a soft delete.
                </p>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={closeModal} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-[10px] font-semibold transition-all">
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={formLoading}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-semibold transition-all"
                  >
                    {formLoading ? 'Deleting...' : 'Delete User'}
                  </button>
                </div>
              </div>
            )}

            {/* Change Role Modal */}
            {modal.type === 'change-role' && modal.user && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <UserCog className="w-4 h-4 text-violet-400" />
                    <h3 className="text-sm font-bold text-white">Change User Role</h3>
                  </div>
                  <button onClick={closeModal} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
                {formError && (
                  <div className="mb-4 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] text-rose-400">{formError}</div>
                )}
                <div className="p-4 bg-zinc-800/40 border border-zinc-700/50 rounded-xl mb-4">
                  <p className="text-xs text-zinc-300 font-semibold">{modal.user.name}</p>
                  <p className="text-[10px] text-zinc-500">Current role: {modal.user.role}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5">New Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full bg-zinc-800/60 border border-zinc-700 focus:border-indigo-500/50 rounded-lg px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="admin">Administrator</option>
                    <option value="agent">Agent</option>
                    <option value="end_user">Employee</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={closeModal} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-[10px] font-semibold transition-all">
                    Cancel
                  </button>
                  <button
                    onClick={handleChangeRole}
                    disabled={formLoading}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-semibold transition-all"
                  >
                    {formLoading ? 'Updating...' : 'Change Role'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

