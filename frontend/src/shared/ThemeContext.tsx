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
  | 'warm-slate'
  | 'teal-night'
  | 'forest'
  | 'ocean'
  | 'purple'
  | 'corporate-blue'
  | 'soft-black';

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
  {
    id: 'teal-night',
    name: 'Teal Night',
    tokens: {
      '--app-bg': '#042f2e', '--surface-bg': '#083b3a', '--card-bg': 'rgba(13, 64, 62, 0.55)', '--card-bg-solid': '#0d403e',
      '--sidebar-bg': '#022524', '--sidebar-hover': '#084b49', '--sidebar-active': '#084b49', '--navbar-bg': '#063533',
      '--border': '#115e59', '--border-strong': '#14b8a6',
      '--text-primary': '#ccfbf1', '--text-secondary': '#7dd3c9', '--text-tertiary': '#5eead4',
      '--accent-primary': '#2dd4bf', '--accent-primary-hover': '#5eead4', '--accent-primary-bg': 'rgba(45, 212, 191, 0.14)', '--accent-primary-contrast': '#042f2e',
      '--accent-secondary': '#06b6d4', '--accent-secondary-bg': 'rgba(6, 182, 212, 0.14)',
      '--hover': 'rgba(20, 184, 166, 0.08)', '--input-bg': 'rgba(13, 64, 62, 0.90)',
      '--status-success': '#34d399', '--status-success-bg': 'rgba(52, 211, 153, 0.16)',
      '--status-warning': '#fbbf24', '--status-warning-bg': 'rgba(251, 191, 36, 0.14)',
      '--status-error': '#fb7185', '--status-error-bg': 'rgba(251, 113, 133, 0.16)',
      '--status-info': '#67e8f9', '--status-info-bg': 'rgba(103, 232, 249, 0.16)',
      '--chart-1': '#2dd4bf', '--chart-2': '#34d399', '--chart-3': '#fbbf24', '--chart-4': '#f472b6', '--chart-5': '#38bdf8', '--chart-6': '#a78bfa',
      '--scroll-track': 'transparent', '--scroll-thumb': 'rgba(20, 184, 166, 0.35)', '--scroll-thumb-hover': 'rgba(45, 212, 191, 0.55)', '--scrollbar': 'rgba(20, 184, 166, 0.35)',
    },
  },
  {
    id: 'forest',
    name: 'Mauve Canvas',
    tokens: {
      '--app-bg': '#f5eff3', '--surface-bg': '#eee3e9', '--card-bg': 'rgba(255, 251, 253, 0.90)', '--card-bg-solid': '#fffafd',
      '--sidebar-bg': '#e9dce3', '--sidebar-hover': '#ded0d9', '--sidebar-active': '#ded0d9', '--navbar-bg': '#f1e7ed',
      '--border': '#c7b3bf', '--border-strong': '#a98497',
      '--text-primary': '#30242c', '--text-secondary': '#5f4b57', '--text-tertiary': '#806875',
      '--accent-primary': '#765b88', '--accent-primary-hover': '#624a72', '--accent-primary-bg': 'rgba(118, 91, 136, 0.12)', '--accent-primary-contrast': '#ffffff',
      '--accent-secondary': '#387a86', '--accent-secondary-bg': 'rgba(56, 122, 134, 0.11)',
      '--hover': 'rgba(48, 36, 44, 0.06)', '--input-bg': '#fff9fb',
      '--status-success': '#2f7665', '--status-success-bg': 'rgba(47, 118, 101, 0.11)',
      '--status-warning': '#98621b', '--status-warning-bg': 'rgba(152, 98, 27, 0.11)',
      '--status-error': '#ad4561', '--status-error-bg': 'rgba(173, 69, 97, 0.10)',
      '--status-info': '#3f6598', '--status-info-bg': 'rgba(63, 101, 152, 0.10)',
      '--chart-1': '#765b88', '--chart-2': '#387a86', '--chart-3': '#98621b', '--chart-4': '#ad4561', '--chart-5': '#3f6598', '--chart-6': '#75845c',
      '--scroll-track': 'transparent', '--scroll-thumb': 'rgba(128, 104, 117, 0.42)', '--scroll-thumb-hover': 'rgba(95, 75, 87, 0.60)', '--scrollbar': 'rgba(128, 104, 117, 0.42)',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    tokens: {
      '--app-bg': '#0b1b2b', '--surface-bg': '#0e2236', '--card-bg': 'rgba(15, 33, 56, 0.55)', '--card-bg-solid': '#12243d',
      '--sidebar-bg': '#081422', '--sidebar-hover': '#123049', '--sidebar-active': '#123049', '--navbar-bg': '#0c1d30',
      '--border': '#1e3a5f', '--border-strong': '#2b5486',
      '--text-primary': '#e0f2fe', '--text-secondary': '#9fc1de', '--text-tertiary': '#6b8fb3',
      '--accent-primary': '#38bdf8', '--accent-primary-hover': '#7dd3fc', '--accent-primary-bg': 'rgba(56, 189, 248, 0.12)', '--accent-primary-contrast': '#0b1b2b',
      '--accent-secondary': '#0ea5e9', '--accent-secondary-bg': 'rgba(14, 165, 233, 0.12)',
      '--hover': 'rgba(56, 189, 248, 0.08)', '--input-bg': 'rgba(15, 33, 56, 0.90)',
      '--status-success': '#2dd4bf', '--status-success-bg': 'rgba(45, 212, 191, 0.14)',
      '--status-warning': '#fbbf24', '--status-warning-bg': 'rgba(251, 191, 36, 0.12)',
      '--status-error': '#fb7185', '--status-error-bg': 'rgba(251, 113, 133, 0.14)',
      '--status-info': '#60a5fa', '--status-info-bg': 'rgba(96, 165, 250, 0.14)',
      '--chart-1': '#38bdf8', '--chart-2': '#2dd4bf', '--chart-3': '#818cf8', '--chart-4': '#f472b6', '--chart-5': '#0ea5e9', '--chart-6': '#a78bfa',
      '--scroll-track': 'transparent', '--scroll-thumb': 'rgba(56, 189, 248, 0.30)', '--scroll-thumb-hover': 'rgba(56, 189, 248, 0.50)', '--scrollbar': 'rgba(56, 189, 248, 0.30)',
    },
  },
  {
    id: 'purple',
    name: 'Purple',
    tokens: {
      '--app-bg': '#180f2b', '--surface-bg': '#211436', '--card-bg': 'rgba(38, 22, 60, 0.55)', '--card-bg-solid': '#281840',
      '--sidebar-bg': '#130a24', '--sidebar-hover': '#2c1a47', '--sidebar-active': '#2c1a47', '--navbar-bg': '#1b1030',
      '--border': '#3b2560', '--border-strong': '#5b3a8f',
      '--text-primary': '#f3e8ff', '--text-secondary': '#c4b5db', '--text-tertiary': '#9a86b8',
      '--accent-primary': '#a855f7', '--accent-primary-hover': '#c084fc', '--accent-primary-bg': 'rgba(168, 85, 247, 0.14)', '--accent-primary-contrast': '#ffffff',
      '--accent-secondary': '#d946ef', '--accent-secondary-bg': 'rgba(217, 70, 239, 0.12)',
      '--hover': 'rgba(168, 85, 247, 0.08)', '--input-bg': 'rgba(38, 22, 60, 0.90)',
      '--status-success': '#34d399', '--status-success-bg': 'rgba(52, 211, 153, 0.14)',
      '--status-warning': '#fbbf24', '--status-warning-bg': 'rgba(251, 191, 36, 0.12)',
      '--status-error': '#fb7185', '--status-error-bg': 'rgba(251, 113, 133, 0.14)',
      '--status-info': '#818cf8', '--status-info-bg': 'rgba(129, 140, 248, 0.14)',
      '--chart-1': '#a855f7', '--chart-2': '#d946ef', '--chart-3': '#818cf8', '--chart-4': '#34d399', '--chart-5': '#f472b6', '--chart-6': '#38bdf8',
      '--scroll-track': 'transparent', '--scroll-thumb': 'rgba(168, 85, 247, 0.30)', '--scroll-thumb-hover': 'rgba(168, 85, 247, 0.50)', '--scrollbar': 'rgba(168, 85, 247, 0.30)',
    },
  },
  {
    id: 'corporate-blue',
    name: 'Corporate Blue',
    tokens: {
      '--app-bg': '#0f172a', '--surface-bg': '#152036', '--card-bg': 'rgba(30, 41, 59, 0.50)', '--card-bg-solid': '#1e293b',
      '--sidebar-bg': '#0b1220', '--sidebar-hover': '#1c2942', '--sidebar-active': '#1c2942', '--navbar-bg': '#111c30',
      '--border': '#334155', '--border-strong': '#475569',
      '--text-primary': '#f1f5f9', '--text-secondary': '#cbd5e1', '--text-tertiary': '#94a3b8',
      '--accent-primary': '#3b82f6', '--accent-primary-hover': '#60a5fa', '--accent-primary-bg': 'rgba(59, 130, 246, 0.12)', '--accent-primary-contrast': '#ffffff',
      '--accent-secondary': '#0ea5e9', '--accent-secondary-bg': 'rgba(14, 165, 233, 0.12)',
      '--hover': 'rgba(148, 163, 184, 0.10)', '--input-bg': 'rgba(30, 41, 59, 0.85)',
      '--status-success': '#22c55e', '--status-success-bg': 'rgba(34, 197, 94, 0.12)',
      '--status-warning': '#f59e0b', '--status-warning-bg': 'rgba(245, 158, 11, 0.12)',
      '--status-error': '#ef4444', '--status-error-bg': 'rgba(239, 68, 68, 0.12)',
      '--status-info': '#38bdf8', '--status-info-bg': 'rgba(56, 189, 248, 0.12)',
      '--chart-1': '#3b82f6', '--chart-2': '#0ea5e9', '--chart-3': '#22c55e', '--chart-4': '#f59e0b', '--chart-5': '#8b5cf6', '--chart-6': '#14b8a6',
      '--scroll-track': 'transparent', '--scroll-thumb': 'rgba(71, 85, 105, 0.45)', '--scroll-thumb-hover': 'rgba(100, 116, 139, 0.65)', '--scrollbar': 'rgba(71, 85, 105, 0.45)',
    },
  },
  {
    id: 'soft-black',
    name: 'Ivory Bloom',
    tokens: {
      '--app-bg': '#f7f3eb', '--surface-bg': '#eee7da', '--card-bg': 'rgba(255, 253, 248, 0.88)', '--card-bg-solid': '#fffdf8',
      '--sidebar-bg': '#ebe2d3', '--sidebar-hover': '#e0d5c4', '--sidebar-active': '#e0d5c4', '--navbar-bg': '#f2ebdf',
      '--border': '#c9bdaa', '--border-strong': '#a99a84',
      '--text-primary': '#28231d', '--text-secondary': '#50473d', '--text-tertiary': '#706354',
      '--accent-primary': '#006d77', '--accent-primary-hover': '#005b63', '--accent-primary-bg': 'rgba(0, 109, 119, 0.11)', '--accent-primary-contrast': '#ffffff',
      '--accent-secondary': '#b4533c', '--accent-secondary-bg': 'rgba(180, 83, 60, 0.10)',
      '--hover': 'rgba(40, 35, 29, 0.06)', '--input-bg': '#fffcf6',
      '--status-success': '#087e5b', '--status-success-bg': 'rgba(8, 126, 91, 0.11)',
      '--status-warning': '#a65b00', '--status-warning-bg': 'rgba(166, 91, 0, 0.11)',
      '--status-error': '#bd3654', '--status-error-bg': 'rgba(189, 54, 84, 0.10)',
      '--status-info': '#2364a3', '--status-info-bg': 'rgba(35, 100, 163, 0.10)',
      '--chart-1': '#006d77', '--chart-2': '#087e5b', '--chart-3': '#a65b00', '--chart-4': '#bd3654', '--chart-5': '#2364a3', '--chart-6': '#805ad5',
      '--scroll-track': 'transparent', '--scroll-thumb': 'rgba(112, 99, 84, 0.40)', '--scroll-thumb-hover': 'rgba(80, 71, 61, 0.58)', '--scrollbar': 'rgba(112, 99, 84, 0.40)',
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
