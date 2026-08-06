import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../shared/AppContext';
import { useTheme } from '../shared/ThemeContext';
import { Sparkles, ShieldAlert, KeyRound, ArrowRight, UserCircle2, CheckCircle2 } from 'lucide-react';
import { AnimatedHeroBackground } from '../components/AnimatedHeroBackground';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useApp();
  const { tokens } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() => (location.state as { notice?: string } | null)?.notice || '');
  const [isLoading, setIsLoading] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  const getRoleRedirect = (role: string): string => {
    switch (role) {
      case 'Administrator':
        return '/admin/dashboard';
      case 'Agent':
        return '/agent/dashboard';
      default:
        return '/dashboard';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setNotice('');
    
    try {
      await login(email, password);
      // Retrieve the logged-in user to redirect based on role
      const savedUser = localStorage.getItem('it_copilot_user');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        const redirectPath = getRoleRedirect(user.role);
        navigate(redirectPath, { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      const message = (err as Error).message || 'Invalid email or password';
      setError(message === 'Account pending admin approval.'
        ? 'Your account was created successfully but is still awaiting administrator approval. Please try again after approval.'
        : message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen font-sans flex items-center justify-center relative overflow-hidden p-6" style={{ backgroundColor: 'var(--app-bg)', color: 'var(--text-primary)' }}>
      <AnimatedHeroBackground />
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full blur-[80px] pointer-events-none" style={{ backgroundColor: `${tokens.accentPrimary}1A` }} />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full blur-[80px] pointer-events-none" style={{ backgroundColor: `${tokens.accentSecondary}1A` }} />

      <div className="w-full max-w-md rounded-2xl p-8 backdrop-blur-xl relative z-10 shadow-2xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-xl mb-4" style={{ backgroundColor: `${tokens.accentPrimary}1A`, border: `1px solid ${tokens.accentPrimary}33` }}>
            <Sparkles className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>ITSM Console Access</h2>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>Sign in to your corporate helpdesk workstation</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {notice && (
            <div className="p-3 rounded-lg flex items-start space-x-2.5 text-xs" style={{ backgroundColor: 'var(--status-success-bg)', border: '1px solid var(--status-success)', color: 'var(--status-success)' }}>
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}
          {error && (
            <div className="p-3 rounded-lg flex items-start space-x-2.5 text-xs" style={{ backgroundColor: 'var(--status-error-bg)', border: '1px solid var(--status-error)', color: 'var(--status-error)' }}>
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Corporate Email</label>
            <input
              id="login-email"
              name="email"
              type="email" 
              placeholder="name@company.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              disabled={isLoading}
              className="w-full rounded-lg px-3 py-2.5 text-xs outline-none transition-all disabled:opacity-50"
              style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
            <div className="relative">
            <input
              id="login-password"
              name="password"
              type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full rounded-lg pl-3 pr-10 py-2.5 text-xs outline-none transition-all disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
              <KeyRound className="absolute right-3.5 top-3 w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => navigate('/forgot-password', { replace: true })}
              className="text-xs font-medium transition-colors"
              style={{ color: 'var(--accent-primary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              Forgot password?
            </button>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg font-medium text-xs flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-contrast)' }}
            onMouseEnter={(e)=>{ if (!isLoading) e.currentTarget.style.backgroundColor='var(--accent-primary-hover)'; }}
            onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor='var(--accent-primary)'; }}
          >
            <span>{isLoading ? 'Signing in...' : 'Initiate Handshake'}</span>
            {!isLoading && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>

        {/* Register Link */}
        <div className="mt-4 text-center">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/register', { replace: true })}
              className="font-medium transition-colors"
              style={{ color: 'var(--accent-primary)' }}
              onMouseEnter={(e)=>{ e.currentTarget.style.opacity='0.8'; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.opacity='1'; }}
            >
              Create Account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
