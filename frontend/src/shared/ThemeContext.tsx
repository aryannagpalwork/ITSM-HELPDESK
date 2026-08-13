import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/* ─────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH FOR THEMES
 *
 * To add a new theme, add ONE entry to the THEMES array below with a
 * full `tokens` palette. The CSS custom properties are generated and
 * injected automatically (see injectThemeStyles) and the dropdown
 * preview cards are derived from the same tokens — no duplication.
 * ───────────────────────────────────────────────────────────── */

export type ThemeId =
  | 'dark-navy'
  | 'light'
  | 'charcoal'
  | 'warm-slate';

/** The complete set of CSS custom properties every theme must define. */
export interface ThemeTokens {
  '--app-bg': string;
  '--surface-bg': string;
  '--card-bg': string;
  '--card-bg-solid': string;
  '--sidebar-bg': string;
  '--sidebar-hover': string;
  '--sidebar-active': string;
  '--navbar-bg': string;
  '--border': string;
  '--border-strong': string;
  '--text-primary': string;
  '--text-secondary': string;
  '--text-tertiary': string;
  '--accent-primary': string;
  '--accent-primary-hover': string;
  '--accent-primary-bg': string;
  /** Readable text/icon color to place ON an accent-primary background. */
  '--accent-primary-contrast': string;
  '--accent-secondary': string;
  '--accent-secondary-bg': string;
  '--hover': string;
  '--input-bg': string;
  '--status-success': string;
  '--status-success-bg': string;
  '--status-warning': string;
  '--status-warning-bg': string;
  '--status-error': string;
  '--status-error-bg': string;
  '--status-info': string;
  '--status-info-bg': string;
  '--chart-1': string;
  '--chart-2': string;
  '--chart-3': string;
  '--chart-4': string;
  '--chart-5': string;
  '--chart-6': string;
  '--scroll-track': string;
  '--scroll-thumb': string;
  '--scroll-thumb-hover': string;
  '--scrollbar': string;
}

export interface ThemePreview {
  previewApp: string;
  previewSurface: string;
  previewCard: string;
  previewAccent: string;
  previewSecondary: string;
  previewBadge: string;
  previewText: string;
  previewBorder: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  swatch: string;
  tokens: ThemeTokens;
  preview: ThemePreview;
}

interface RawTheme {
  id: ThemeId;
  name: string;
  tokens: ThemeTokens;
}

const RAW_THEMES: RawTheme[] = [
  {
    id: 'dark-navy',
    name: 'Dark Navy',
    tokens: {
      '--app-bg': '#09090b', '--surface-bg': '#0a0a0a', '--card-bg': 'rgba(24, 24, 27, 0.40)', '--card-bg-solid': '#18181b',
      '--sidebar-bg': '#09090b', '--sidebar-hover': '#18181b', '--sidebar-active': '#18181b', '--navbar-bg': '#0a0a0a',
      '--border': '#27272a', '--border-strong': '#3f3f46',
      '--text-primary': '#fafafa', '--text-secondary': '#a1a1aa', '--text-tertiary': '#71717a',
      '--accent-primary': '#6366f1', '--accent-primary-hover': '#818cf8', '--accent-primary-bg': 'rgba(99, 102, 241, 0.10)', '--accent-primary-contrast': '#ffffff',
      '--accent-secondary': '#8b5cf6', '--accent-secondary-bg': 'rgba(139, 92, 246, 0.10)',
      '--hover': 'rgba(82, 82, 91, 0.25)', '--input-bg': 'rgba(24, 24, 27, 0.80)',
      '--status-success': '#10b981', '--status-success-bg': 'rgba(16, 185, 129, 0.12)',
      '--status-warning': '#f59e0b', '--status-warning-bg': 'rgba(245, 158, 11, 0.12)',
      '--status-error': '#f43f5e', '--status-error-bg': 'rgba(244, 63, 94, 0.12)',
      '--status-info': '#3b82f6', '--status-info-bg': 'rgba(59, 130, 246, 0.12)',
      '--chart-1': '#6366f1', '--chart-2': '#10b981', '--chart-3': '#f59e0b', '--chart-4': '#ec4899', '--chart-5': '#3b82f6', '--chart-6': '#14b8a6',
      '--scroll-track': 'transparent', '--scroll-thumb': 'rgba(63, 63, 70, 0.40)', '--scroll-thumb-hover': 'rgba(82, 82, 91, 0.60)', '--scrollbar': 'rgba(63, 63, 70, 0.40)',
    },
  },
  {
    id: 'light',
    name: 'Light',
    tokens: {
      '--app-bg': '#ffffff', '--surface-bg': '#ffffff', '--card-bg': 'rgba(255, 255, 255, 0.90)', '--card-bg-solid': '#ffffff',
      '--sidebar-bg': '#f8fafc', '--sidebar-hover': '#eef2f7', '--sidebar-active': '#e6ecf4', '--navbar-bg': '#ffffff',
      '--border': '#e5e7eb', '--border-strong': '#cbd5e1',
      '--text-primary': '#0f172a', '--text-secondary': '#475569', '--text-tertiary': '#64748b',
      '--accent-primary': '#4f46e5', '--accent-primary-hover': '#6366f1', '--accent-primary-bg': 'rgba(79, 70, 229, 0.08)', '--accent-primary-contrast': '#ffffff',
      '--accent-secondary': '#7c3aed', '--accent-secondary-bg': 'rgba(124, 58, 237, 0.08)',
      '--hover': 'rgba(15, 23, 42, 0.05)', '--input-bg': '#ffffff',
      '--status-success': '#059669', '--status-success-bg': 'rgba(5, 150, 105, 0.10)',
      '--status-warning': '#d97706', '--status-warning-bg': 'rgba(217, 119, 6, 0.10)',
      '--status-error': '#e11d48', '--status-error-bg': 'rgba(225, 29, 72, 0.10)',
      '--status-info': '#2563eb', '--status-info-bg': 'rgba(37, 99, 235, 0.10)',
      '--chart-1': '#4f46e5', '--chart-2': '#059669', '--chart-3': '#d97706', '--chart-4': '#db2777', '--chart-5': '#2563eb', '--chart-6': '#0d9488',
      '--scroll-track': 'transparent', '--scroll-thumb': 'rgba(100, 116, 139, 0.35)', '--scroll-thumb-hover': 'rgba(100, 116, 139, 0.55)', '--scrollbar': 'rgba(100, 116, 139, 0.35)',
    },
  },
  {
    id: 'charcoal',
    name: 'Charcoal',
    tokens: {
      '--app-bg': '#121212', '--surface-bg': '#161616', '--card-bg': 'rgba(32, 32, 32, 0.55)', '--card-bg-solid': '#202020',
      '--sidebar-bg': '#101010', '--sidebar-hover': '#1c1c1c', '--sidebar-active': '#1c1c1c', '--navbar-bg': '#151515',
      '--border': '#2a2a2a', '--border-strong': '#3a3a3a',
      '--text-primary': '#f5f5f5', '--text-secondary': '#a3a3a3', '--text-tertiary': '#737373',
      '--accent-primary': '#ef4444', '--accent-primary-hover': '#f87171', '--accent-primary-bg': 'rgba(239, 68, 68, 0.10)', '--accent-primary-contrast': '#ffffff',
      '--accent-secondary': '#f97316', '--accent-secondary-bg': 'rgba(249, 115, 22, 0.10)',
      '--hover': 'rgba(255, 255, 255, 0.04)', '--input-bg': 'rgba(28, 28, 28, 0.90)',
      '--status-success': '#22c55e', '--status-success-bg': 'rgba(34, 197, 94, 0.12)',
      '--status-warning': '#eab308', '--status-warning-bg': 'rgba(234, 179, 8, 0.12)',
      '--status-error': '#ef4444', '--status-error-bg': 'rgba(239, 68, 68, 0.15)',
      '--status-info': '#38bdf8', '--status-info-bg': 'rgba(56, 189, 248, 0.12)',
      '--chart-1': '#ef4444', '--chart-2': '#22c55e', '--chart-3': '#eab308', '--chart-4': '#f97316', '--chart-5': '#38bdf8', '--chart-6': '#a855f7',
      '--scroll-track': 'transparent', '--scroll-thumb': 'rgba(90, 90, 90, 0.45)', '--scroll-thumb-hover': 'rgba(115, 115, 115, 0.65)', '--scrollbar': 'rgba(90, 90, 90, 0.45)',
    },
  },
  {
    id: 'warm-slate',
    name: 'Warm Slate',
    tokens: {
      '--app-bg': '#1c1917', '--surface-bg': '#231f1c', '--card-bg': 'rgba(44, 39, 36, 0.55)', '--card-bg-solid': '#2c2724',
      '--sidebar-bg': '#1a1614', '--sidebar-hover': '#2a2420', '--sidebar-active': '#2a2420', '--navbar-bg': '#201b18',
      '--border': '#3a332f', '--border-strong': '#50443d',
      '--text-primary': '#fef3c7', '--text-secondary': '#c9b89b', '--text-tertiary': '#a68d6b',
      '--accent-primary': '#d97706', '--accent-primary-hover': '#f59e0b', '--accent-primary-bg': 'rgba(217, 119, 6, 0.14)', '--accent-primary-contrast': '#1c1917',
      '--accent-secondary': '#fde68a', '--accent-secondary-bg': 'rgba(253, 230, 138, 0.12)',
      '--hover': 'rgba(253, 230, 138, 0.05)', '--input-bg': 'rgba(38, 33, 29, 0.90)',
      '--status-success': '#84cc16', '--status-success-bg': 'rgba(132, 204, 22, 0.14)',
      '--status-warning': '#facc15', '--status-warning-bg': 'rgba(250, 204, 21, 0.14)',
      '--status-error': '#f87171', '--status-error-bg': 'rgba(248, 113, 113, 0.14)',
      '--status-info': '#fbbf24', '--status-info-bg': 'rgba(251, 191, 36, 0.14)',
      '--chart-1': '#d97706', '--chart-2': '#84cc16', '--chart-3': '#facc15', '--chart-4': '#fb7185', '--chart-5': '#a78bfa', '--chart-6': '#22d3ee',
      '--scroll-track': 'transparent', '--scroll-thumb': 'rgba(95, 77, 63, 0.55)', '--scroll-thumb-hover': 'rgba(125, 102, 82, 0.75)', '--scrollbar': 'rgba(95, 77, 63, 0.55)',
    },
  },
];

const STORAGE_KEY = 'itsm:theme';
const DEFAULT_THEME: ThemeId = 'dark-navy';

function buildPreview(tokens: ThemeTokens): ThemePreview {
  return {
    previewApp: tokens['--app-bg'],
    previewSurface: tokens['--card-bg-solid'],
    previewCard: tokens['--card-bg'],
    previewAccent: tokens['--accent-primary'],
    previewSecondary: tokens['--accent-secondary'],
    previewBadge: tokens['--status-success'],
    previewText: tokens['--text-primary'],
    previewBorder: tokens['--border'],
  };
}

/** Public theme list — id, name, swatch and derived preview (single source of truth). */
export const THEMES: ThemeDefinition[] = RAW_THEMES.map(t => ({
  ...t,
  swatch: t.tokens['--app-bg'],
  preview: buildPreview(t.tokens),
}));

/* ─── Generate & inject the CSS variable blocks once, before first paint ─── */

function buildThemeCss(): string {
  return THEMES.map(t => {
    // Use `:root[data-theme=...]` (specificity 0,2,0) so a selected theme always
    // overrides the plain `:root` bootstrap fallback in index.css (0,1,0),
    // regardless of stylesheet load order (dev/prod).
    const selector = t.id === DEFAULT_THEME
      ? `:root,\n:root[data-theme="${t.id}"]`
      : `:root[data-theme="${t.id}"]`;
    const body = (Object.entries(t.tokens) as [string, string][])
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
    return `${selector} {\n${body}\n}`;
  }).join('\n\n');
}

function injectThemeStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('theme-tokens')) return;
  const style = document.createElement('style');
  style.id = 'theme-tokens';
  style.textContent = buildThemeCss();
  document.head.appendChild(style);
}

// Runs at module load — before ReactDOM renders — so tokens exist on first paint.
injectThemeStyles();

export interface ChartPalette {
  stroke: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipLabel: string;
  grid: string;
  palette: string[];
}

export interface ThemePaletteTokens {
  appBg: string;
  surfaceBg: string;
  cardBg: string;
  cardBgSolid: string;
  sidebarBg: string;
  navbarBg: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accentPrimary: string;
  accentPrimaryBg: string;
  accentSecondary: string;
  accentSecondaryBg: string;
  hover: string;
  inputBg: string;
  statusSuccess: string;
  statusSuccessBg: string;
  statusWarning: string;
  statusWarningBg: string;
  statusError: string;
  statusErrorBg: string;
  statusInfo: string;
  statusInfoBg: string;
}

export interface ThemeContextType {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  cycleTheme: () => void;
  tokens: ThemePaletteTokens;
  chart: ChartPalette;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function readStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES.some(t => t.id === saved)) return saved as ThemeId;
  } catch { /* ignore */ }
  return DEFAULT_THEME;
}

function applyThemeOnDocument(theme: ThemeId) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  const swatch = THEMES.find(t => t.id === theme)?.swatch ?? '#09090b';
  if (meta) {
    meta.setAttribute('content', swatch);
  } else {
    const newMeta = document.createElement('meta');
    newMeta.name = 'theme-color';
    newMeta.content = swatch;
    document.head.appendChild(newMeta);
  }
}

function cssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v;
}

function buildTokens(): ThemePaletteTokens {
  return {
    appBg: cssVar('--app-bg'),
    surfaceBg: cssVar('--surface-bg'),
    cardBg: cssVar('--card-bg'),
    cardBgSolid: cssVar('--card-bg-solid'),
    sidebarBg: cssVar('--sidebar-bg'),
    navbarBg: cssVar('--navbar-bg'),
    border: cssVar('--border'),
    borderStrong: cssVar('--border-strong'),
    textPrimary: cssVar('--text-primary'),
    textSecondary: cssVar('--text-secondary'),
    textTertiary: cssVar('--text-tertiary'),
    accentPrimary: cssVar('--accent-primary'),
    accentPrimaryBg: cssVar('--accent-primary-bg'),
    accentSecondary: cssVar('--accent-secondary'),
    accentSecondaryBg: cssVar('--accent-secondary-bg'),
    hover: cssVar('--hover'),
    inputBg: cssVar('--input-bg'),
    statusSuccess: cssVar('--status-success'),
    statusSuccessBg: cssVar('--status-success-bg'),
    statusWarning: cssVar('--status-warning'),
    statusWarningBg: cssVar('--status-warning-bg'),
    statusError: cssVar('--status-error'),
    statusErrorBg: cssVar('--status-error-bg'),
    statusInfo: cssVar('--status-info'),
    statusInfoBg: cssVar('--status-info-bg'),
  };
}

function buildChartPalette(tokens: ThemePaletteTokens): ChartPalette {
  return {
    stroke: tokens.textTertiary,
    tooltipBg: tokens.cardBgSolid,
    tooltipBorder: tokens.border,
    tooltipText: tokens.textPrimary,
    tooltipLabel: tokens.textSecondary,
    grid: tokens.border,
    palette: [
      cssVar('--chart-1'),
      cssVar('--chart-2'),
      cssVar('--chart-3'),
      cssVar('--chart-4'),
      cssVar('--chart-5'),
      cssVar('--chart-6'),
    ].filter(Boolean),
  };
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>(() => readStoredTheme());
  const [, setTick] = useState(0); // trigger re-read of computed styles on theme change

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    applyThemeOnDocument(next);
    // Force CSS variable re-read on next render
    setTick(n => n + 1);
  }, []);

  const cycleTheme = useCallback(() => {
    const idx = THEMES.findIndex(t => t.id === theme);
    const next = THEMES[(idx + 1) % THEMES.length].id;
    setTheme(next);
  }, [theme, setTheme]);

  // Apply stored theme on mount
  useEffect(() => {
    applyThemeOnDocument(theme);
    setTick(n => n + 1);
  }, []);

  const tokens = useMemo(() => buildTokens(), [theme]);
  const chart = useMemo(() => buildChartPalette(tokens), [tokens]);

  const value: ThemeContextType = { theme, setTheme, cycleTheme, tokens, chart };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
