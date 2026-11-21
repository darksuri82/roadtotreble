import { useId } from 'react';
import type { JerseyPattern } from '../../types/league';

interface JerseySvgProps {
  primaryColor: string;
  secondaryColor: string;
  pattern?: JerseyPattern;
  label?: string;
  size?: number;
  className?: string;
}

function getContrastText(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#ffffff';
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.68 ? '#0f172a' : '#f8fafc';
}

export function JerseySvg({
  primaryColor,
  secondaryColor,
  pattern = 'solid',
  label,
  size = 44,
  className = '',
}: JerseySvgProps) {
  const uid = useId().replace(/:/g, '');
  const clipId = `jersey-clip-${uid}`;
  const textColor = getContrastText(primaryColor);

  const jerseyPath =
    'M30 12 L42 8 C46 14 54 14 58 8 L70 12 L92 26 L83 45 L71 39 L71 90 C71 92.5 69 94 66.5 94 L33.5 94 C31 94 29 92.5 29 90 L29 39 L17 45 L8 26 Z';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={jerseyPath} />
        </clipPath>
      </defs>

      {/* Base Jersey Body */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="100" height="100" fill={primaryColor} />

        {pattern === 'stripes' && (
          <>
            <rect x="28" y="0" width="11" height="100" fill={secondaryColor} />
            <rect x="45" y="0" width="10" height="100" fill={secondaryColor} />
            <rect x="61" y="0" width="11" height="100" fill={secondaryColor} />
          </>
        )}

        {pattern === 'hoops' && (
          <>
            <rect x="0" y="24" width="100" height="12" fill={secondaryColor} />
            <rect x="0" y="48" width="100" height="12" fill={secondaryColor} />
            <rect x="0" y="72" width="100" height="12" fill={secondaryColor} />
          </>
        )}

        {pattern === 'sash' && (
          <polygon points="16,0 38,0 88,100 66,100" fill={secondaryColor} />
        )}

        {pattern === 'half' && (
          <rect x="50" y="0" width="50" height="100" fill={secondaryColor} />
        )}

        {/* Sleeve cuffs */}
        <polygon points="8,24 19,46 24,43 13,21" fill={secondaryColor} opacity="0.9" />
        <polygon points="92,24 81,46 76,43 87,21" fill={secondaryColor} opacity="0.9" />

        {/* Subtle cloth shading */}
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill="url(#jerseyShade)"
          opacity="0.22"
        />
      </g>

      <defs>
        <linearGradient id="jerseyShade" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Collar & Outline */}
      <path
        d={jerseyPath}
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M41 9 C45 17 55 17 59 9"
        stroke={secondaryColor}
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Center chest label */}
      {label && (
        <>
          <rect
            x="33"
            y="47"
            width="34"
            height="17"
            rx="4"
            fill="rgba(9,14,20,0.68)"
          />
          <text
            x="50"
            y="59.5"
            textAnchor="middle"
            fill={pattern === 'solid' ? '#f8fafc' : textColor === '#0f172a' ? '#f8fafc' : '#f8fafc'}
            fontSize="10.5"
            fontWeight="800"
            fontFamily="Oswald, Inter, sans-serif"
            letterSpacing="0.06em"
          >
            {label.slice(0, 4)}
          </text>
        </>
      )}
    </svg>
  );
}
