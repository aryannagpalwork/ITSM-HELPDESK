import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, KeyRound, ShieldAlert } from 'lucide-react';
import { changePassword } from '../shared/api';

export const ChangePassword: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await changePassword(currentPassword, newPassword, confirmPassword);
      setMessage(result.detail);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError((err as Error).message || 'Unable to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="change-password-workspace" className="flex-1 h-full overflow-y-auto p-6 sm:p-8 font-sans" style={{ backgroundColor: 'var(--app-bg)', color: 'var(--text-primary)' }}>
      <div className="max-w-2xl">
        <div className="mb-6">
          <p className="text-[10px] font-mono tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>Profile Security</p>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Change password</h1>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>Update your current password without changing the rest of the workspace layout.</p>
        </div>

        <div className="rounded-2xl p-6 shadow-xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            {error && (
              <div className="p-3 rounded-lg flex items-start space-x-2.5 text-xs" style={{ backgroundColor: 'var(--status-error-bg)', border: '1px solid var(--status-error)', color: 'var(--status-error)' }}>
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="p-3 rounded-lg flex items-start space-x-2.5 text-xs" style={{ backgroundColor: 'var(--status-success-bg)', border: '1px solid var(--status-success)', color: 'var(--status-success)' }}>
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Current password</label>
              <div className="relative">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setError(''); }}
                  disabled={isLoading}
                  className="w-full rounded-lg pl-10 pr-3 py-2.5 text-xs outline-none transition-all disabled:opacity-50"
                  style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
                <KeyRound className="absolute left-3 top-3 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>New password</label>
              <div className="relative">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                  disabled={isLoading}
                  className="w-full rounded-lg pl-10 pr-3 py-2.5 text-xs outline-none transition-all disabled:opacity-50"
                  style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
                <KeyRound className="absolute left-3 top-3 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Confirm new password</label>
              <div className="relative">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  disabled={isLoading}
                  className="w-full rounded-lg pl-10 pr-3 py-2.5 text-xs outline-none transition-all disabled:opacity-50"
                  style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
                <KeyRound className="absolute left-3 top-3 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg font-medium text-xs flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-contrast)' }}
              onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-primary)'; }}
            >
              <span>{isLoading ? 'Saving...' : 'Change password'}</span>
              {!isLoading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
