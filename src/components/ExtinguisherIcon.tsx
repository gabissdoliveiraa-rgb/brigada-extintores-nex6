/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ExtinguisherIconProps {
  className?: string;
  size?: number;
  color?: string;
}

export const ExtinguisherIcon: React.FC<ExtinguisherIconProps> = ({
  className = 'w-6 h-6',
  size = 24,
  color = 'currentColor',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Extinguisher cylinder */}
      <rect x="7" y="8" width="10" height="13" rx="2" />
      {/* Top nozzle / handle */}
      <path d="M10 8V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v3" />
      {/* Trigger lever */}
      <path d="M8 5h8" />
      {/* Hose */}
      <path d="M14 5h3a2 2 0 0 1 2 2v7a1 1 0 0 1-1 1h-1" />
      {/* Pressure gauge */}
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  );
};
