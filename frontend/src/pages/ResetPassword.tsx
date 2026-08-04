import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../shared/ThemeContext';
import { resetPassword } from '../shared/api';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tokens } = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const token = useMemo(() => {
    const queryToken = new URLSearchParams(location.search).get('token') || '';
    if (queryToken) {
      return queryToken;
    }

    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    if (!hash) {
      return '';
    }

    const hashQuery = hash.includes('?') ? hash.split('?')[1] : '';
    return new URLSearchParams(hashQuery).get('token') || '';
  }, [location.hash, location.search]);

  const email = useMemo(() => {
    const queryEmail = new URLSearchParams(location.search).get('email') || '';
    if (queryEmail) return queryEmail;

    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    if (!hash) return '';
    const hashQuery = hash.includes('?') ? hash.split('?')[1] : '';
    return new URLSearchParams(hashQuery).get('email') || '';
  }, [location.hash, location.search]);

  useEffect(() => {
    const queryToken = new URLSearchParams(location.search).get('token') || '';
    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    const hashQuery = hash.includes('?') ? hash.split('?')[1] : '';
    const hashToken = new URLSearchParams(hashQuery).get('token') || '';

    if (!queryToken && !hashToken && location.pathname === '/reset-password' && location.search) {
      window.location.hash = `#/reset-password${location.search}`;
    }
  }, [location.hash, location.pathname, location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('The reset link is missing a token. Please request a new password reset.');
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      if (!email) {
        setError('The reset link is missing the target email address. Please request a new password reset.');
        return;
      }
      const result = await resetPassword(email, token, newPassword, confirmPassword);
      setMessage(result.detail);
      setTimeout(() => navigate('/login', { replace: true }), 1400);
    } catch (err) {
      const message = (err as Error).message || 'Unable to reset password';
      setError(message.includes('expired') || message.includes('Invalid') || message.includes('used')
        ? 'This reset link has already been used or has expired. Please request a new password reset.'
        : message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative p-6" style={{ backgroundColor: 'var(--app-bg)', color: 'var(--text-primary)' }}>
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full blur-[80px] pointer-events-none" style={{ backgroundColor: `${tokens.accentPrimary}1A` }} />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full blur-[80px] pointer-events-none" style={{ backgroundColor: `${tokens.accentSecondary}1A` }} />

      <div className="w-full max-w-md rounded-2xl p-8 backdrop-blur-xl relative z-10 shadow-2xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-xl mb-4" style={{ backgroundColor: `${tokens.accentPrimary}1A`, border: `1px solid ${tokens.accentPrimary}33` }}>
            <Sparkles className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Set New Password</h2>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>Choose a new password for your account</p>
        </div>

        {!token && (
          <div className="mb-4 p-3 rounded-lg flex items-start space-x-2.5 text-xs" style={{ backgroundColor: 'var(--status-error-bg)', border: '1px solid var(--status-error)', color: 'var(--status-error)' }}>
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>The reset link is missing its token. Please request a new password reset.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-[11px] font-mono uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>New password</label>
            <div className="relative">
              <input
                type="password"
                placeholder="Enter a new password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                disabled={isLoading || !token}
                className="w-full rounded-lg pl-10 pr-3 py-2.5 text-xs outline-none transition-all disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
              <KeyRound className="absolute left-3 top-3 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Confirm password</label>
            <div className="relative">
              <input
                type="password"
                placeholder="Confirm the new password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                disabled={isLoading || !token}
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
            disabled={isLoading || !token}
            className="w-full py-2.5 rounded-lg font-medium text-xs flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-contrast)' }}
            onMouseEnter={(e) => { if (!isLoading && token) e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-primary)'; }}
          >
            <span>{isLoading ? 'Updating...' : 'Reset password'}</span>
            {!isLoading && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="text-xs font-medium transition-colors"
            style={{ color: 'var(--accent-primary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
};
