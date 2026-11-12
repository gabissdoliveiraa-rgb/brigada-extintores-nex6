/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import senaiLogoUrl from '../assets/senai_logo.png';

interface SenaiLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

export const SenaiLogo: React.FC<SenaiLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  const imgHeightClass =
    size === 'sm'
      ? 'h-7 sm:h-8'
      : size === 'lg'
      ? 'h-11 sm:h-12'
      : 'h-9 sm:h-10';

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      {/* Official SENAI Logo imported via bundler for perfect GitHub Pages compatibility */}
      {!hasError ? (
        <img
          src={senaiLogoUrl}
          alt="SENAI"
          onError={() => setHasError(true)}
          className={`${imgHeightClass} w-auto object-contain drop-shadow-xs transition-transform duration-200`}
          draggable={false}
        />
      ) : (
        /* Vector fallback with official SENAI colors and typography if network is restricted */
        <div
          className={`bg-[#e30613] text-white font-black italic tracking-tighter px-3.5 py-1 rounded flex items-center justify-center shadow-xs ${imgHeightClass}`}
        >
          <span className="text-xl sm:text-2xl font-black tracking-normal">SENAI</span>
        </div>
      )}

      {showSubtitle && (
        <span
          className={`font-bold tracking-tight text-slate-900 mt-2 ${
            size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base'
          }`}
        >
          Brigada &amp; Extintores
        </span>
      )}
    </div>
  );
};
