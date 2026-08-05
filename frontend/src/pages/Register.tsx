import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../shared/AppContext';
import { useTheme } from '../shared/ThemeContext';
import { Sparkles, ShieldAlert, KeyRound, ArrowRight, UserCircle2, CheckCircle2 } from 'lucide-react';
import { AnimatedHeroBackground } from '../components/AnimatedHeroBackground';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useApp();
  const { tokens } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Employee' | 'Agent'>('Employee');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError('Please fill in all required fields');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await register(fullName, email, password, role);
      const acknowledgement = response.message || 'Your account request was delivered to the administrator and is now queued for approval. You can sign in after approval.';
      setSuccess(`${acknowledgement} Redirecting to login...`);
      setTimeout(() => {
        navigate('/login', { state: { notice: acknowledgement }, replace: true });
      }, 1000);
    } catch (err) {
      setError((err as Error).message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="register-container" className="min-h-screen font-sans flex items-center justify-center relative overflow-hidden p-6" style={{ backgroundColor: 'var(--app-bg)', color: 'var(--text-primary)' }}>
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
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Create Account</h2>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>Join the ITSM helpdesk workstation</p>
        </div>

        {/* Register Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg flex items-start space-x-2.5 text-xs" style={{ backgroundColor: 'var(--status-error-bg)', border: '1px solid var(--status-error)', color: 'var(--status-error)' }}>
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg flex items-start space-x-2.5 text-xs" style={{ backgroundColor: 'var(--status-success-bg)', border: '1px solid var(--status-success)', color: 'var(--status-success)' }}>
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setError(''); }}
                disabled={isLoading}
                className="w-full rounded-lg pl-10 pr-3 py-2.5 text-xs outline-none transition-all disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
              <UserCircle2 className="absolute left-3 top-3 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Corporate Email</label>
            <input 
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

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Role</label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'Employee' | 'Agent')}
                disabled={isLoading}
                className="w-full rounded-lg px-3 py-2.5 text-xs outline-none transition-all disabled:opacity-50 appearance-none cursor-pointer"
                style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <option value="Employee">Employee</option>
                <option value="Agent">Agent</option>
              </select>
              <ArrowRight className="absolute right-3 top-3 w-3.5 h-3.5 rotate-90 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg font-medium text-xs flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-contrast)' }}
            onMouseEnter={(e)=>{ if (!isLoading) e.currentTarget.style.backgroundColor='var(--accent-primary-hover)'; }}
            onMouseLeave={(e)=>{ e.currentTarget.style.backgroundColor='var(--accent-primary)'; }}
          >
            <span>{isLoading ? 'Creating Account...' : 'Create Account'}</span>
            {!isLoading && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="font-medium transition-colors"
              style={{ color: 'var(--accent-primary)' }}
              onMouseEnter={(e)=>{ e.currentTarget.style.opacity='0.8'; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.opacity='1'; }}
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
