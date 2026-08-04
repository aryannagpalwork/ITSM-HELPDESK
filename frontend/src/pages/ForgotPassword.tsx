import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldAlert, Sparkles, Link2, Mail } from 'lucide-react';
import { useTheme } from '../shared/ThemeContext';
import { forgotPassword } from '../shared/api';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const { tokens } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [previewLink, setPreviewLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [cooldownActive, setCooldownActive] = useState(false);

  useEffect(() => {
    if (!cooldownActive) {
      return;
    }

    if (cooldownSeconds <= 0) {
      setCooldownActive(false);
      return;
    }

    const timer = window.setTimeout(() => setCooldownSeconds(prev => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownActive, cooldownSeconds]);

  const buttonLabel = useMemo(() => {
    if (isLoading) {
      return 'Sending link...';
    }
    if (cooldownActive) {
      return `Resend in ${cooldownSeconds}s`;
    }
    return 'Send reset link';
  }, [cooldownActive, cooldownSeconds, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    if (cooldownActive) {
      setError('Please wait a moment before requesting another reset link.');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');
    setPreviewLink('');

    try {
      const result = await forgotPassword(email);
      setMessage(result.detail);
      if (result.resetLink) {
        setPreviewLink(result.resetLink);
      }
      setCooldownSeconds(60);
      setCooldownActive(true);
    } catch (err) {
      // If the error is due to a recent request, we can also trigger the cooldown
      const errorMessage = (err as Error).message;
      if (errorMessage.includes("rate limit") || errorMessage.includes("wait")) {
        setCooldownSeconds(60);
        setCooldownActive(true);
      }
      setError(errorMessage || 'Unable to process password reset request');
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
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Reset Access</h2>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>We will send a password reset link to your email</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg flex items-start space-x-2.5 text-xs" style={{ backgroundColor: 'var(--status-error-bg)', border: '1px solid var(--status-error)', color: 'var(--status-error)' }}>
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="p-3 rounded-lg flex items-start space-x-2.5 text-xs" style={{ backgroundColor: 'var(--status-success-bg)', border: '1px solid var(--status-success)', color: 'var(--status-success)' }}>
              <Mail className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Corporate Email</label>
            <div className="relative">
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                disabled={isLoading}
                className="w-full rounded-lg pl-10 pr-3 py-2.5 text-xs outline-none transition-all disabled:opacity-50"
                style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
              <Mail className="absolute left-3 top-3 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || cooldownActive}
            className="w-full py-2.5 rounded-lg font-medium text-xs flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-contrast)' }}
            onMouseEnter={(e) => { if (!isLoading && !cooldownActive) e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-primary)'; }}
          >
            <span>{buttonLabel}</span>
            {!isLoading && !cooldownActive && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>

        {previewLink && (
          <div className="mt-4 p-4 rounded-xl border text-xs" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <span className="font-semibold">Preview reset link</span>
            </div>
            <a href={previewLink} className="break-all" style={{ color: 'var(--accent-primary)' }}>
              {previewLink}
            </a>
          </div>
        )}

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

