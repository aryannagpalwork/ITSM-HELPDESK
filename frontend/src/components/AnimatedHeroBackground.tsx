import React from 'react';

/** Decorative animated backdrop for public/auth screens. It has no interactive state. */
export const AnimatedHeroBackground: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
    <div className="absolute inset-0 bg-[#050711] opacity-95" />
    <div className="absolute -inset-[15%] opacity-80 blur-2xl">
      <svg className="h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" fill="none">
        <defs>
          <linearGradient id="hero-indigo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4338ca" stopOpacity="0" />
            <stop offset="0.48" stopColor="#6366f1" stopOpacity="0.9" />
            <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hero-violet" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#818cf8" stopOpacity="0" />
            <stop offset="0.5" stopColor="#8b5cf6" stopOpacity="0.8" />
            <stop offset="1" stopColor="#312e81" stopOpacity="0" />
          </linearGradient>
          <filter id="hero-glow">
            <feGaussianBlur stdDeviation="13" />
          </filter>
        </defs>
        <g filter="url(#hero-glow)" strokeLinecap="round">
          <path className="hero-ribbon hero-ribbon-one" d="M-80 690 C 180 580, 250 190, 545 240 S 760 760, 1010 570 S 1320 80, 1700 230" stroke="url(#hero-indigo)" strokeWidth="34" />
          <path className="hero-ribbon hero-ribbon-two" d="M-100 120 C 190 40, 290 440, 545 500 S 840 60, 1080 230 S 1370 690, 1690 570" stroke="url(#hero-violet)" strokeWidth="26" />
          <path className="hero-ribbon hero-ribbon-three" d="M-120 820 C 200 690, 420 750, 610 570 S 900 190, 1160 390 S 1430 810, 1710 700" stroke="url(#hero-indigo)" strokeWidth="19" />
          <path className="hero-ribbon hero-ribbon-four" d="M-80 350 C 180 500, 380 120, 650 180 S 940 510, 1190 500 S 1450 260, 1700 420" stroke="url(#hero-violet)" strokeWidth="15" />
        </g>
      </svg>
    </div>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_0%,rgba(5,7,17,0.42)_55%,rgba(5,7,17,0.9)_100%)]" />
  </div>
);

