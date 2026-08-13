import React, { useEffect, useRef, useState } from 'react';
import { Palette, Check, ChevronDown } from 'lucide-react';
import { useTheme, THEMES, ThemeId, ThemePreview } from './ThemeContext';

const ThemeThumbnail: React.FC<{ preview: ThemePreview; active: boolean }> = ({ preview, active }) => (
  <div
    className="relative w-full overflow-hidden rounded-lg"
    style={{
      aspectRatio: '16 / 10',
      backgroundColor: preview.previewApp,
      border: `1px solid ${active ? preview.previewAccent : preview.previewBorder}`,
      boxShadow: active ? `0 0 0 2px ${preview.previewAccent}33` : 'none',
    }}
  >
    <div
      className="absolute inset-x-0 top-0 h-[30%] flex items-center px-2 gap-1.5"
      style={{
        background: `linear-gradient(135deg, ${preview.previewAccent}1A 0%, ${preview.previewSecondary}1A 100%)`,
        borderBottom: `1px solid ${preview.previewBorder}`,
      }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: preview.previewAccent }}
      />
      <div
        className="h-1.5 rounded-sm flex-1"
        style={{ backgroundColor: preview.previewAccent, opacity: 0.85 }}
      />
      <div
        className="h-1.5 w-5 rounded-sm"
        style={{ backgroundColor: preview.previewSecondary, opacity: 0.85 }}
      />
    </div>

    <div className="absolute left-2 right-2 top-[38%] space-y-1.5">
      <div
        className="h-2 rounded-sm w-2/3"
        style={{ backgroundColor: preview.previewText, opacity: 0.9 }}
      />
      <div
        className="h-1.5 rounded-sm w-1/2"
        style={{ backgroundColor: preview.previewText, opacity: 0.5 }}
      />

      <div className="pt-1 grid grid-cols-2 gap-1">
        <div
          className="rounded-md px-1.5 py-1 space-y-1"
          style={{
            backgroundColor: preview.previewSurface,
            border: `1px solid ${preview.previewBorder}`,
          }}
        >
          <div
            className="h-1 rounded-sm w-1/2"
            style={{ backgroundColor: preview.previewAccent }}
          />
          <div
            className="h-2 rounded-sm"
            style={{ backgroundColor: preview.previewText, opacity: 0.85 }}
          />
          <div
            className="h-1 rounded-sm w-2/3"
            style={{ backgroundColor: preview.previewText, opacity: 0.4 }}
          />
        </div>
        <div
          className="rounded-md px-1.5 py-1 space-y-1"
          style={{
            backgroundColor: preview.previewSurface,
            border: `1px solid ${preview.previewBorder}`,
          }}
        >
          <div
            className="h-1 rounded-sm w-1/2"
            style={{ backgroundColor: preview.previewBadge }}
          />
          <div
            className="h-2 rounded-sm"
            style={{ backgroundColor: preview.previewText, opacity: 0.85 }}
          />
          <div
            className="h-1 rounded-sm w-2/3"
            style={{ backgroundColor: preview.previewText, opacity: 0.4 }}
          />
        </div>
      </div>
    </div>

    <div
      className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between"
    >
      <div className="flex items-center gap-1">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: preview.previewBadge }}
        />
        <div
          className="h-1 w-5 rounded-sm"
          style={{ backgroundColor: preview.previewText, opacity: 0.6 }}
        />
      </div>
      <div
        className="h-1.5 w-6 rounded-full"
        style={{ backgroundColor: preview.previewSecondary, opacity: 0.9 }}
      />
    </div>
  </div>
);

export const ThemeSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = THEMES.find(t => t.id === theme) ?? THEMES[0];

  const pick = (id: ThemeId) => {
    setTheme(id);
    setOpen(false);
  };

  if (compact) {
    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          title="Change theme"
          className="w-9 h-9 flex items-center justify-center rounded-lg border transition-all hover:scale-[1.02]"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--card-bg)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <Palette className="w-4 h-4" />
        </button>
        {open && (
          <div
            className="absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain rounded-2xl shadow-2xl z-50 p-3 space-y-3 theme-scroller"
            style={{
              backgroundColor: 'var(--card-bg-solid)',
              border: '1px solid var(--border)',
            } as React.CSSProperties}
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                Theme
              </span>
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'var(--accent-primary-bg)', color: 'var(--accent-primary)' }}
              >
                {THEMES.length} presets
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {THEMES.map(t => {
                const active = t.id === theme;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pick(t.id)}
                    className="group relative flex flex-col rounded-xl p-2 gap-2 transition-all hover:-translate-y-0.5"
                    style={{
                      backgroundColor: active ? 'var(--accent-primary-bg)' : 'transparent',
                      border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border)'}`,
                      outline: active ? 'none' : 'transparent',
                    }}
                  >
                    {active && (
                      <div className="absolute -top-1.5 -right-1.5 z-10">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center shadow-lg"
                          style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-contrast)' }}
                        >
                          <Check className="w-3 h-3" strokeWidth={3} />
                        </div>
                      </div>
                    )}

                    <ThemeThumbnail preview={t.preview} active={active} />

                    <div className="flex items-center justify-between px-0.5">
                      <div className="flex flex-col items-start min-w-0">
                        <span
                          className="text-[11px] font-semibold truncate"
                          style={{ color: active ? 'var(--accent-primary)' : 'var(--text-primary)' }}
                        >
                          {t.name}
                        </span>
                        <span className="flex items-center gap-1 mt-0.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: t.preview.previewBadge }}
                          />
                          <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                            Accent
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: t.preview.previewAccent }}
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: t.preview.previewSecondary }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--card-bg)',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        <Palette className="w-4 h-4" />
        <div className="hidden sm:flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full border"
            style={{ backgroundColor: current.preview.previewAccent, borderColor: 'var(--border-strong)' }}
          />
          <span className="text-[11px] font-mono uppercase tracking-wide">{current.name}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-[400px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain rounded-2xl shadow-2xl z-50 p-4 space-y-3.5 theme-scroller"
          style={{ backgroundColor: 'var(--card-bg-solid)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <div>
                <div className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Appearance
                </div>
                <div className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                  Choose a workspace theme
                </div>
              </div>
            </div>
            <span
              className="text-[9px] font-mono px-2 py-0.5 rounded"
              style={{ backgroundColor: 'var(--accent-primary-bg)', color: 'var(--accent-primary)' }}
            >
              {THEMES.length} presets
            </span>
          </div>

          <div className="h-px w-full" style={{ backgroundColor: 'var(--border)' }} />

          <div className="grid grid-cols-2 gap-3">
            {THEMES.map(t => {
              const active = t.id === theme;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pick(t.id)}
                  className="group relative flex flex-col rounded-xl p-2.5 gap-2.5 transition-all hover:-translate-y-0.5"
                  style={{
                    backgroundColor: active ? 'var(--accent-primary-bg)' : 'transparent',
                    border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border)'}`,
                    outline: active ? 'none' : 'transparent',
                  }}
                >
                  {active && (
                    <div className="absolute -top-2 -right-2 z-10">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                        style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-contrast)' }}
                      >
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      </div>
                    </div>
                  )}

                  <ThemeThumbnail preview={t.preview} active={active} />

                  <div className="flex items-center justify-between px-0.5">
                    <div className="flex flex-col items-start min-w-0">
                      <span
                        className="text-[12px] font-semibold truncate"
                        style={{ color: active ? 'var(--accent-primary)' : 'var(--text-primary)' }}
                      >
                        {t.name}
                      </span>
                      <span className="flex items-center gap-1 mt-0.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: t.preview.previewBadge }}
                        />
                        <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                          Saved to this device
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: t.preview.previewAccent, borderColor: 'var(--border-strong)' }}
                      />
                      <span
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: t.preview.previewSecondary, borderColor: 'var(--border-strong)' }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[9px] font-mono"
            style={{
              backgroundColor: 'var(--accent-secondary-bg)',
              color: 'var(--text-secondary)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: 'var(--accent-secondary)' }}
            />
            <span>Changes apply instantly across dashboards, dialogs, charts, and AI chat.</span>
          </div>
        </div>
      )}
    </div>
  );
};
