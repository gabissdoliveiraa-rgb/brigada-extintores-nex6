/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

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
  const imgHeightClass =
    size === 'sm'
      ? 'h-7 sm:h-8'
      : size === 'lg'
      ? 'h-11 sm:h-12'
      : 'h-9 sm:h-10';

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      {/* Official SENAI Logo Image uploaded by user */}
      <img
        src="/assets/aistudio/image_10_4272392b.png"
        alt="SENAI"
        className={`${imgHeightClass} w-auto object-contain drop-shadow-xs transition-transform duration-200`}
        draggable={false}
      />

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
