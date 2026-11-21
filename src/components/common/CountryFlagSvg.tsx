import type { ReactNode } from 'react';

export interface CountryFlagSvgProps {
  code?: string;
  nationality?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}

const SIZE_MAP: Record<NonNullable<CountryFlagSvgProps['size']>, { w: number; h: number }> = {
  xs: { w: 14, h: 10 },
  sm: { w: 16, h: 11 },
  md: { w: 18, h: 13 },
  lg: { w: 22, h: 15 },
};

/**
 * Resolves a normalized flag key from ISO-2 code + Korean nationality string.
 * Separates UK home nations (England, Scotland, Wales, Northern Ireland)
 * and normalizes South Korea ('한국' / '대한민국').
 */
export function resolveFlagKey(code?: string, nationality?: string): string {
  const nat = (nationality ?? '').trim();
  if (nat === '잉글랜드' || nat === 'England') return 'GB-ENG';
  if (nat === '스코틀랜드' || nat === 'Scotland') return 'GB-SCT';
  if (nat === '웨일스' || nat === 'Wales') return 'GB-WLS';
  if (nat === '북아일랜드' || nat === 'Northern Ireland') return 'GB-NIR';
  if (nat === '한국' || nat === '대한민국') return 'KR';

  const upper = (code ?? '').trim().toUpperCase();
  if (upper) return upper;
  return 'UN';
}

// Helper primitives for 24x16 viewBox
function hTri(c1: string, c2: string, c3: string, overlay?: ReactNode) {
  return (
    <>
      <rect width="24" height="5.34" y="0" fill={c1} />
      <rect width="24" height="5.34" y="5.33" fill={c2} />
      <rect width="24" height="5.34" y="10.66" fill={c3} />
      {overlay}
    </>
  );
}

function vTri(c1: string, c2: string, c3: string, overlay?: ReactNode) {
  return (
    <>
      <rect width="8" height="16" x="0" fill={c1} />
      <rect width="8" height="16" x="8" fill={c2} />
      <rect width="8" height="16" x="16" fill={c3} />
      {overlay}
    </>
  );
}

function hBi(c1: string, c2: string, overlay?: ReactNode) {
  return (
    <>
      <rect width="24" height="8" y="0" fill={c1} />
      <rect width="24" height="8" y="8" fill={c2} />
      {overlay}
    </>
  );
}

function nordic(bg: string, cross: string, border?: string) {
  return (
    <>
      <rect width="24" height="16" fill={bg} />
      {border && (
        <>
          <rect x="6.5" y="0" width="4.4" height="16" fill={border} />
          <rect x="0" y="5.8" width="24" height="4.4" fill={border} />
        </>
      )}
      <rect x="7.5" y="0" width="2.4" height="16" fill={cross} />
      <rect x="0" y="6.8" width="24" height="2.4" fill={cross} />
    </>
  );
}

function star(cx: number, cy: number, r: number, fill: string) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = ((i * 36 - 90) * Math.PI) / 180;
    const dist = i % 2 === 0 ? r : r * 0.42;
    pts.push(`${(cx + Math.cos(rad) * dist).toFixed(2)},${(cy + Math.sin(rad) * dist).toFixed(2)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} />;
}

function unionJackCanton(w = 11, h = 8) {
  return (
    <g>
      <rect width={w} height={h} fill="#012169" />
      <line x1="0" y1="0" x2={w} y2={h} stroke="#fff" strokeWidth="1.6" />
      <line x1={w} y1="0" x2="0" y2={h} stroke="#fff" strokeWidth="1.6" />
      <line x1="0" y1="0" x2={w} y2={h} stroke="#c8102e" strokeWidth="0.7" />
      <line x1={w} y1="0" x2="0" y2={h} stroke="#c8102e" strokeWidth="0.7" />
      <rect x={w / 2 - 1.2} y="0" width="2.4" height={h} fill="#fff" />
      <rect x="0" y={h / 2 - 1.2} width={w} height="2.4" fill="#fff" />
      <rect x={w / 2 - 0.7} y="0" width="1.4" height={h} fill="#c8102e" />
      <rect x="0" y={h / 2 - 0.7} width={w} height="1.4" fill="#c8102e" />
    </g>
  );
}

/**
 * All 105+ dataset flags rendered via crisp inline SVG.
 */
export const SUPPORTED_FLAG_KEYS = new Set<string>([
  'GB-ENG', 'GB-SCT', 'GB-WLS', 'GB-NIR', 'GB',
  'ES', 'FR', 'DE', 'IT', 'BR', 'NL', 'AR', 'PT', 'BE', 'DK', 'MA', 'SN',
  'CH', 'CI', 'AT', 'SE', 'HR', 'JP', 'NG', 'DZ', 'NO', 'US', 'PL', 'RS',
  'TR', 'GH', 'UY', 'CM', 'ML', 'GR', 'CD', 'CA', 'IE', 'GE', 'CO', 'XK',
  'CZ', 'BA', 'AL', 'KR', 'UA', 'SK', 'EC', 'SI', 'HU', 'IS', 'RO', 'BF',
  'ME', 'MX', 'AU', 'GN', 'RU', 'PY', 'CL', 'ID', 'GW', 'TG', 'TN', 'AO',
  'GM', 'IL', 'VE', 'JM', 'GA', 'MR', 'FI', 'CF', 'EG', 'HT', 'MK', 'BG',
  'MQ', 'NE', 'KM', 'ZM', 'CG', 'BJ', 'UZ', 'CV', 'SA', 'CR', 'JO', 'LU',
  'GQ', 'SL', 'PE', 'GP', 'AM', 'LT', 'EE', 'NZ', 'MZ', 'BI', 'SR', 'MY',
  'PH', 'TH', 'TZ', 'MG',
]);

function renderFlagArtwork(key: string): ReactNode {
  switch (key) {
    // UK Home Nations
    case 'GB-ENG':
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          <rect x="10.4" y="0" width="3.2" height="16" fill="#ce1124" />
          <rect x="0" y="6.4" width="24" height="3.2" fill="#ce1124" />
        </>
      );
    case 'GB-SCT':
      return (
        <>
          <rect width="24" height="16" fill="#005eb8" />
          <line x1="0" y1="0" x2="24" y2="16" stroke="#ffffff" strokeWidth="3.2" />
          <line x1="24" y1="0" x2="0" y2="16" stroke="#ffffff" strokeWidth="3.2" />
        </>
      );
    case 'GB-WLS':
      return hBi(
        '#ffffff',
        '#00ab39',
        <>
          {/* Stylized Red Dragon silhouette */}
          <path
            d="M6.5 11.8 L8.2 9.2 L7.2 7.5 L9.8 6.4 L11.5 4.8 L13.8 5.2 L14.4 6.6 L16.8 6.2 L18.2 8.2 L16.5 10.2 L17.6 12 L15.2 11.4 L13.8 12.6 L12.2 11.2 L10.2 12.6 L9 11.3 Z"
            fill="#d30731"
          />
          <circle cx="9.2" cy="7.2" r="0.6" fill="#ffd700" />
        </>,
      );
    case 'GB-NIR':
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          <rect x="10.4" y="0" width="3.2" height="16" fill="#ce1124" />
          <rect x="0" y="6.4" width="24" height="3.2" fill="#ce1124" />
          <polygon points="12,5 13.6,6.8 14.5,8 13.6,9.2 12,11 10.4,9.2 9.5,8 10.4,6.8" fill="#ffffff" stroke="#ce1124" strokeWidth="0.4" />
          <rect x="11.3" y="7.1" width="1.4" height="1.8" fill="#ce1124" />
          <rect x="11.2" y="4.2" width="1.6" height="0.9" fill="#f5b800" />
        </>
      );
    case 'GB':
      return (
        <>
          <rect width="24" height="16" fill="#012169" />
          <line x1="0" y1="0" x2="24" y2="16" stroke="#ffffff" strokeWidth="3.2" />
          <line x1="24" y1="0" x2="0" y2="16" stroke="#ffffff" strokeWidth="3.2" />
          <line x1="0" y1="0" x2="24" y2="16" stroke="#c8102e" strokeWidth="1.4" />
          <line x1="24" y1="0" x2="0" y2="16" stroke="#c8102e" strokeWidth="1.4" />
          <rect x="9.6" y="0" width="4.8" height="16" fill="#ffffff" />
          <rect x="0" y="5.6" width="24" height="4.8" fill="#ffffff" />
          <rect x="10.6" y="0" width="2.8" height="16" fill="#c8102e" />
          <rect x="0" y="6.6" width="24" height="2.8" fill="#c8102e" />
        </>
      );

    // Europe Top Leagues & Major Nations
    case 'ES':
      return (
        <>
          <rect width="24" height="4" y="0" fill="#aa151b" />
          <rect width="24" height="8" y="4" fill="#f1bf00" />
          <rect width="24" height="4" y="12" fill="#aa151b" />
          <rect x="5.5" y="6" width="2.8" height="4" rx="0.6" fill="#aa151b" />
          <rect x="6.1" y="6.7" width="1.6" height="2.6" fill="#f1bf00" />
        </>
      );
    case 'FR':
      return vTri('#002395', '#ffffff', '#ed2939');
    case 'DE':
      return hTri('#111111', '#dd0000', '#ffce00');
    case 'IT':
      return vTri('#009246', '#ffffff', '#ce2b37');
    case 'PT':
      return (
        <>
          <rect width="9.5" height="16" x="0" fill="#006600" />
          <rect width="14.5" height="16" x="9.5" fill="#ff0000" />
          <circle cx="9.5" cy="8" r="3" fill="#ffcc00" />
          <rect x="8.3" y="6.6" width="2.4" height="2.8" rx="0.5" fill="#d90000" />
          <rect x="8.9" y="7.2" width="1.2" height="1.6" fill="#ffffff" />
        </>
      );
    case 'NL':
      return hTri('#ae1c28', '#ffffff', '#21468b');
    case 'BE':
      return vTri('#111111', '#fdda24', '#ef3340');
    case 'CH':
      return (
        <>
          <rect width="24" height="16" fill="#d52b1e" />
          <rect x="10.4" y="3.5" width="3.2" height="9" fill="#ffffff" />
          <rect x="7.5" y="6.4" width="9" height="3.2" fill="#ffffff" />
        </>
      );
    case 'AT':
      return hTri('#ed2939', '#ffffff', '#ed2939');
    case 'DK':
      return nordic('#c60c30', '#ffffff');
    case 'SE':
      return nordic('#006aa7', '#fecc00');
    case 'NO':
      return nordic('#ba0c2f', '#00205b', '#ffffff');
    case 'FI':
      return nordic('#ffffff', '#003580');
    case 'IS':
      return nordic('#02529c', '#dc1e35', '#ffffff');
    case 'HR':
      return hTri(
        '#ff0000',
        '#ffffff',
        '#171796',
        <>
          <rect x="10" y="5.3" width="4" height="5.2" rx="0.5" fill="#ffffff" stroke="#ff0000" strokeWidth="0.6" />
          <rect x="10.5" y="5.8" width="1.5" height="1.5" fill="#ff0000" />
          <rect x="12" y="7.3" width="1.5" height="1.5" fill="#ff0000" />
          <rect x="10.5" y="8.8" width="1.5" height="1.5" fill="#ff0000" />
        </>,
      );
    case 'PL':
      return hBi('#ffffff', '#dc143c');
    case 'RS':
      return hTri(
        '#c6363c',
        '#0c4076',
        '#ffffff',
        <rect x="6" y="4.5" width="3.4" height="5.2" rx="0.8" fill="#c6363c" stroke="#f2c94c" strokeWidth="0.6" />,
      );
    case 'TR':
      return (
        <>
          <rect width="24" height="16" fill="#e30a17" />
          <circle cx="9.8" cy="8" r="3.6" fill="#ffffff" />
          <circle cx="10.9" cy="8" r="2.9" fill="#e30a17" />
          {star(14.5, 8, 1.7, '#ffffff')}
        </>
      );
    case 'GR':
      return (
        <>
          <rect width="24" height="16" fill="#0d5eaf" />
          {[1, 3, 5, 7].map((i) => (
            <rect key={i} y={(i * 16) / 9} width="24" height={16 / 9} fill="#ffffff" />
          ))}
          <rect width="9" height={(5 * 16) / 9} fill="#0d5eaf" />
          <rect x="3.6" y="0" width="1.8" height={(5 * 16) / 9} fill="#ffffff" />
          <rect x="0" y={(2 * 16) / 9} width="9" height={16 / 9} fill="#ffffff" />
        </>
      );
    case 'IE':
      return vTri('#169b62', '#ffffff', '#ff883e');
    case 'GE':
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          <rect x="10.5" y="0" width="3" height="16" fill="#ff0000" />
          <rect x="0" y="6.5" width="24" height="3" fill="#ff0000" />
          {[
            [5, 3.2],
            [19, 3.2],
            [5, 12.8],
            [19, 12.8],
          ].map(([cx, cy], idx) => (
            <g key={idx}>
              <rect x={cx - 0.5} y={cy - 1.5} width="1" height="3" fill="#ff0000" />
              <rect x={cx - 1.5} y={cy - 0.5} width="3" height="1" fill="#ff0000" />
            </g>
          ))}
        </>
      );
    case 'XK':
      return (
        <>
          <rect width="24" height="16" fill="#244aa5" />
          <polygon points="12,5.5 15.2,9 12.2,12.5 9.2,9.4" fill="#d0a650" />
          {[9.2, 10.6, 12, 13.4, 14.8].map((x, idx) => (
            <circle key={idx} cx={x} cy={idx === 2 ? 3.2 : idx === 1 || idx === 3 ? 3.6 : 4.2} r="0.55" fill="#ffffff" />
          ))}
        </>
      );
    case 'CZ':
      return (
        <>
          {hBi('#ffffff', '#d7141a')}
          <polygon points="0,0 11,8 0,16" fill="#11457e" />
        </>
      );
    case 'BA':
      return (
        <>
          <rect width="24" height="16" fill="#002395" />
          <polygon points="6,0 18.5,0 18.5,16" fill="#fecb00" />
          {[1.5, 4.5, 7.5, 10.5, 13.5].map((y, idx) => (
            <circle key={idx} cx={4.8 + idx * 2.5} cy={y} r="0.8" fill="#ffffff" />
          ))}
        </>
      );
    case 'AL':
      return (
        <>
          <rect width="24" height="16" fill="#e41e20" />
          <path d="M9.5 6 L11.4 7.5 L12 5.4 L12.6 7.5 L14.5 6 L13.8 9.2 L15 11.4 L12.6 10.2 L12 12.2 L11.4 10.2 L9 11.4 L10.2 9.2 Z" fill="#111111" />
        </>
      );
    case 'UA':
      return hBi('#0057b7', '#ffd700');
    case 'SK':
      return hTri(
        '#ffffff',
        '#0b4ea2',
        '#ee1c25',
        <rect x="5.2" y="4.5" width="3.8" height="5.8" rx="1" fill="#ee1c25" stroke="#ffffff" strokeWidth="0.6" />,
      );
    case 'SI':
      return hTri(
        '#ffffff',
        '#005da4',
        '#ed1c24',
        <rect x="4.5" y="3.5" width="3.2" height="4" rx="0.7" fill="#005da4" stroke="#ffffff" strokeWidth="0.5" />,
      );
    case 'HU':
      return hTri('#ce2939', '#ffffff', '#477050');
    case 'RO':
      return vTri('#002b7f', '#fcd116', '#ce1126');
    case 'ME':
      return (
        <>
          <rect width="24" height="16" fill="#c40308" stroke="#d4af37" strokeWidth="1.6" />
          <circle cx="12" cy="8" r="2.8" fill="#d4af37" />
        </>
      );
    case 'RU':
      return hTri('#ffffff', '#0039a6', '#d52b1e');
    case 'MK':
      return (
        <>
          <rect width="24" height="16" fill="#d20000" />
          <line x1="0" y1="0" x2="24" y2="16" stroke="#ffe600" strokeWidth="1.8" />
          <line x1="24" y1="0" x2="0" y2="16" stroke="#ffe600" strokeWidth="1.8" />
          <line x1="12" y1="0" x2="12" y2="16" stroke="#ffe600" strokeWidth="1.6" />
          <line x1="0" y1="8" x2="24" y2="8" stroke="#ffe600" strokeWidth="1.6" />
          <circle cx="12" cy="8" r="2.8" fill="#ffe600" stroke="#d20000" strokeWidth="0.7" />
        </>
      );
    case 'BG':
      return hTri('#ffffff', '#00966e', '#d62612');
    case 'LU':
      return hTri('#ea141d', '#ffffff', '#00a1de');
    case 'AM':
      return hTri('#d90012', '#0033a0', '#f2a800');
    case 'LT':
      return hTri('#fdb913', '#006a44', '#c1272d');
    case 'EE':
      return hTri('#0072ce', '#111111', '#ffffff');

    // Americas
    case 'BR':
      return (
        <>
          <rect width="24" height="16" fill="#009c3b" />
          <polygon points="12,2.2 21.2,8 12,13.8 2.8,8" fill="#ffdf00" />
          <circle cx="12" cy="8" r="3.1" fill="#002776" />
          <path d="M9.1 7.6 Q12 6.6 14.9 8.4" fill="none" stroke="#ffffff" strokeWidth="0.7" />
        </>
      );
    case 'AR':
      return hTri('#74acdf', '#ffffff', '#74acdf', <circle cx="12" cy="8" r="1.6" fill="#f6b40e" />);
    case 'UY':
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          {[1, 3, 5, 7].map((i) => (
            <rect key={i} y={(i * 16) / 9} width="24" height={16 / 9} fill="#0038a8" />
          ))}
          <rect width="9" height={(5 * 16) / 9} fill="#ffffff" />
          <circle cx="4.5" cy="4.4" r="2.1" fill="#fcd116" />
        </>
      );
    case 'US':
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          {[0, 2, 4, 6, 8, 10, 12].map((i) => (
            <rect key={i} y={(i * 16) / 13} width="24" height={16 / 13} fill="#b22234" />
          ))}
          <rect width="10.5" height={(7 * 16) / 13} fill="#3c3b6e" />
          {[2, 5.2, 8.4].map((x) =>
            [2, 4.3, 6.6].map((y) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="0.55" fill="#ffffff" />
            )),
          )}
        </>
      );
    case 'CA':
      return (
        <>
          <rect width="6" height="16" x="0" fill="#ff0000" />
          <rect width="12" height="16" x="6" fill="#ffffff" />
          <rect width="6" height="16" x="18" fill="#ff0000" />
          <polygon points="12,3.5 13.1,6.4 15.6,5.8 14.2,8.5 15.8,9.5 12.6,10.2 12.5,12.5 11.5,12.5 11.4,10.2 8.2,9.5 9.8,8.5 8.4,5.8 10.9,6.4" fill="#ff0000" />
        </>
      );
    case 'CO':
      return (
        <>
          <rect width="24" height="8" y="0" fill="#fcd116" />
          <rect width="24" height="4" y="8" fill="#003893" />
          <rect width="24" height="4" y="12" fill="#ce1126" />
        </>
      );
    case 'EC':
      return (
        <>
          <rect width="24" height="8" y="0" fill="#ffd100" />
          <rect width="24" height="4" y="8" fill="#034ea2" />
          <rect width="24" height="4" y="12" fill="#ed1c24" />
          <circle cx="12" cy="8" r="1.8" fill="#8b5a2b" />
        </>
      );
    case 'MX':
      return vTri('#006847', '#ffffff', '#ce1126', <circle cx="12" cy="8" r="1.7" fill="#8b5a2b" />);
    case 'PY':
      return hTri('#d52b1e', '#ffffff', '#0038a8', <circle cx="12" cy="8" r="1.4" fill="#f7c948" />);
    case 'CL':
      return (
        <>
          {hBi('#ffffff', '#d52b1e')}
          <rect width="8.5" height="8" fill="#0039a6" />
          {star(4.25, 4, 2, '#ffffff')}
        </>
      );
    case 'VE':
      return hTri(
        '#ffcc00',
        '#00247d',
        '#cf142b',
        <>
          {[9.5, 10.7, 12, 13.3, 14.5].map((x, idx) => (
            <circle key={idx} cx={x} cy={8.6 - Math.sin((idx / 4) * Math.PI) * 1.4} r="0.5" fill="#ffffff" />
          ))}
        </>,
      );
    case 'JM':
      return (
        <>
          <rect width="24" height="16" fill="#009b3a" />
          <polygon points="0,1.5 9.8,8 0,14.5" fill="#111111" />
          <polygon points="24,1.5 14.2,8 24,14.5" fill="#111111" />
          <line x1="0" y1="0" x2="24" y2="16" stroke="#fed100" strokeWidth="2.5" />
          <line x1="24" y1="0" x2="0" y2="16" stroke="#fed100" strokeWidth="2.5" />
        </>
      );
    case 'HT':
      return hBi('#00209f', '#d21034', <rect x="9.8" y="6.2" width="4.4" height="3.6" fill="#ffffff" />);
    case 'CR':
      return (
        <>
          <rect width="24" height="2.7" y="0" fill="#002b7f" />
          <rect width="24" height="2.7" y="2.7" fill="#ffffff" />
          <rect width="24" height="5.2" y="5.4" fill="#ce1126" />
          <rect width="24" height="2.7" y="10.6" fill="#ffffff" />
          <rect width="24" height="2.7" y="13.3" fill="#002b7f" />
        </>
      );
    case 'PE':
      return vTri('#d91023', '#ffffff', '#d91023');
    case 'SR':
      return (
        <>
          <rect width="24" height="3.2" y="0" fill="#377e3f" />
          <rect width="24" height="1.6" y="3.2" fill="#ffffff" />
          <rect width="24" height="6.4" y="4.8" fill="#b40a2d" />
          <rect width="24" height="1.6" y="11.2" fill="#ffffff" />
          <rect width="24" height="3.2" y="12.8" fill="#377e3f" />
          {star(12, 8, 2.2, '#ecc81d')}
        </>
      );
    case 'MQ':
      return (
        <>
          {hBi('#00a650', '#111111')}
          <polygon points="0,0 11,8 0,16" fill="#ef1923" />
        </>
      );
    case 'GP':
      return vTri('#002395', '#ffffff', '#ed2939', <circle cx="12" cy="8" r="1.4" fill="#f7c948" />);

    // Asia & Oceania
    case 'KR':
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          {/* Taegeuk */}
          <circle cx="12" cy="8" r="3.8" fill="#cd2e3a" />
          <path d="M8.2 8 A3.8 3.8 0 0 0 15.8 8 A1.9 1.9 0 0 1 12 8 A1.9 1.9 0 0 0 8.2 8 Z" fill="#0047a0" />
          {/* 4 Trigrams */}
          <g stroke="#111111" strokeWidth="0.7">
            <line x1="3.8" y1="4.8" x2="6.3" y2="2.3" />
            <line x1="4.7" y1="5.7" x2="7.2" y2="3.2" />
            <line x1="17.7" y1="2.3" x2="20.2" y2="4.8" />
            <line x1="16.8" y1="3.2" x2="19.3" y2="5.7" />
            <line x1="3.8" y1="11.2" x2="6.3" y2="13.7" />
            <line x1="4.7" y1="10.3" x2="7.2" y2="12.8" />
            <line x1="17.7" y1="13.7" x2="20.2" y2="11.2" />
            <line x1="16.8" y1="12.8" x2="19.3" y2="10.3" />
          </g>
        </>
      );
    case 'JP':
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          <circle cx="12" cy="8" r="4.2" fill="#bc002d" />
        </>
      );
    case 'AU':
      return (
        <>
          <rect width="24" height="16" fill="#012169" />
          {unionJackCanton(11, 8)}
          {star(5.5, 12.2, 1.8, '#ffffff')}
          <circle cx="17.5" cy="4.2" r="0.8" fill="#ffffff" />
          <circle cx="20.5" cy="7" r="0.8" fill="#ffffff" />
          <circle cx="15" cy="7.5" r="0.8" fill="#ffffff" />
          <circle cx="17.5" cy="12" r="0.8" fill="#ffffff" />
        </>
      );
    case 'NZ':
      return (
        <>
          <rect width="24" height="16" fill="#012169" />
          {unionJackCanton(11, 8)}
          <circle cx="17.5" cy="3.8" r="0.9" fill="#cc142b" stroke="#ffffff" strokeWidth="0.35" />
          <circle cx="20.5" cy="6.8" r="0.9" fill="#cc142b" stroke="#ffffff" strokeWidth="0.35" />
          <circle cx="15.2" cy="7.2" r="0.9" fill="#cc142b" stroke="#ffffff" strokeWidth="0.35" />
          <circle cx="17.5" cy="12" r="1" fill="#cc142b" stroke="#ffffff" strokeWidth="0.35" />
        </>
      );
    case 'ID':
      return hBi('#ce1126', '#ffffff');
    case 'UZ':
      return (
        <>
          <rect width="24" height="5" y="0" fill="#1eb53a" />
          <rect width="24" height="5" y="0" fill="#0099b5" />
          <rect width="24" height="0.7" y="5" fill="#ce1126" />
          <rect width="24" height="4.6" y="5.7" fill="#ffffff" />
          <rect width="24" height="0.7" y="10.3" fill="#ce1126" />
          <rect width="24" height="5" y="11" fill="#1eb53a" />
          <circle cx="4.2" cy="2.5" r="1.4" fill="#ffffff" />
          <circle cx="4.8" cy="2.5" r="1.2" fill="#0099b5" />
        </>
      );
    case 'SA':
      return (
        <>
          <rect width="24" height="16" fill="#006c35" />
          <rect x="6" y="5.5" width="12" height="2" rx="0.8" fill="#ffffff" />
          <rect x="7" y="9.8" width="10" height="1.1" fill="#ffffff" />
        </>
      );
    case 'JO':
      return (
        <>
          {hTri('#111111', '#ffffff', '#007a3d')}
          <polygon points="0,0 10.5,8 0,16" fill="#ce1126" />
          {star(3.8, 8, 1.3, '#ffffff')}
        </>
      );
    case 'IL':
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          <rect width="24" height="2.2" y="1.6" fill="#0038b8" />
          <rect width="24" height="2.2" y="12.2" fill="#0038b8" />
          <polygon points="12,5 14.6,9.5 9.4,9.5" fill="none" stroke="#0038b8" strokeWidth="0.75" />
          <polygon points="12,11 14.6,6.5 9.4,6.5" fill="none" stroke="#0038b8" strokeWidth="0.75" />
        </>
      );
    case 'MY':
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          {[0, 2, 4, 6, 8, 10, 12].map((i) => (
            <rect key={i} y={(i * 16) / 14} width="24" height={16 / 14} fill="#cc0001" />
          ))}
          <rect width="11" height="9.2" fill="#010066" />
          <circle cx="4.8" cy="4.6" r="2.3" fill="#ffcc00" />
          <circle cx="5.7" cy="4.6" r="1.9" fill="#010066" />
          {star(7.9, 4.6, 1.4, '#ffcc00')}
        </>
      );
    case 'PH':
      return (
        <>
          {hBi('#0038a8', '#ce1126')}
          <polygon points="0,0 10.5,8 0,16" fill="#ffffff" />
          <circle cx="3.8" cy="8" r="1.8" fill="#fcd116" />
        </>
      );
    case 'TH':
      return (
        <>
          <rect width="24" height="2.6" y="0" fill="#a51931" />
          <rect width="24" height="2.6" y="2.6" fill="#f4f5f8" />
          <rect width="24" height="5.6" y="5.2" fill="#2d2a4a" />
          <rect width="24" height="2.6" y="10.8" fill="#f4f5f8" />
          <rect width="24" height="2.6" y="13.4" fill="#a51931" />
        </>
      );

    // Africa
    case 'MA':
      return (
        <>
          <rect width="24" height="16" fill="#c1272d" />
          {star(12, 8, 3.2, '#006233')}
        </>
      );
    case 'SN':
      return vTri('#00853f', '#fdef42', '#e31b23', star(12, 8, 2.2, '#00853f'));
    case 'CI':
      return vTri('#f77f00', '#ffffff', '#009e60');
    case 'NG':
      return vTri('#008751', '#ffffff', '#008751');
    case 'DZ':
      return (
        <>
          <rect width="12" height="16" x="0" fill="#006233" />
          <rect width="12" height="16" x="12" fill="#ffffff" />
          <circle cx="12" cy="8" r="3.4" fill="#d21034" />
          <circle cx="13.1" cy="8" r="2.7" fill="#ffffff" />
          <path d="M12 4.6 A3.4 3.4 0 0 0 12 11.4" fill="#d21034" />
          {star(13.6, 8, 1.4, '#d21034')}
        </>
      );
    case 'GH':
      return hTri('#ce1126', '#fcd116', '#006b3f', star(12, 8, 2.1, '#111111'));
    case 'CM':
      return vTri('#007a5e', '#ce1126', '#fcd116', star(12, 8, 2.1, '#fcd116'));
    case 'ML':
      return vTri('#14b53a', '#fcd116', '#ce1126');
    case 'CD':
      return (
        <>
          <rect width="24" height="16" fill="#007fff" />
          <line x1="0" y1="16" x2="24" y2="0" stroke="#f7d618" strokeWidth="5.4" />
          <line x1="0" y1="16" x2="24" y2="0" stroke="#ce1021" strokeWidth="3.8" />
          {star(4.5, 4.2, 2.1, '#f7d618')}
        </>
      );
    case 'BF':
      return hBi('#ef2b2d', '#009e49', star(12, 8, 2.3, '#fcd116'));
    case 'GN':
      return vTri('#ce1126', '#fcd116', '#009460');
    case 'GW':
      return (
        <>
          <rect width="16" height="8" x="8" y="0" fill="#fcd116" />
          <rect width="16" height="8" x="8" y="8" fill="#009e49" />
          <rect width="8.5" height="16" x="0" y="0" fill="#ce1126" />
          {star(4.2, 8, 2.2, '#111111')}
        </>
      );
    case 'TG':
      return (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} y={(i * 16) / 5} width="24" height={16 / 5} fill={i % 2 === 0 ? '#006a4e' : '#ffce00'} />
          ))}
          <rect width="9.6" height="9.6" fill="#d21034" />
          {star(4.8, 4.8, 2.4, '#ffffff')}
        </>
      );
    case 'TN':
      return (
        <>
          <rect width="24" height="16" fill="#e70013" />
          <circle cx="12" cy="8" r="4" fill="#ffffff" />
          <circle cx="12.3" cy="8" r="2.7" fill="#e70013" />
          <circle cx="13.2" cy="8" r="2.2" fill="#ffffff" />
          {star(13.4, 8, 1.3, '#e70013')}
        </>
      );
    case 'AO':
      return hBi('#cc092f', '#111111', <circle cx="12" cy="8" r="2.3" fill="none" stroke="#ffcb00" strokeWidth="1.2" strokeDasharray="2 1" />);
    case 'GM':
      return (
        <>
          <rect width="24" height="5.2" y="0" fill="#ce1126" />
          <rect width="24" height="1" y="5.2" fill="#ffffff" />
          <rect width="24" height="3.6" y="6.2" fill="#0c1c8c" />
          <rect width="24" height="1" y="9.8" fill="#ffffff" />
          <rect width="24" height="5.2" y="10.8" fill="#3a7728" />
        </>
      );
    case 'GA':
      return hTri('#009e60', '#fcd116', '#3a75c4');
    case 'MR':
      return (
        <>
          <rect width="24" height="2.4" y="0" fill="#d01c1f" />
          <rect width="24" height="11.2" y="2.4" fill="#006233" />
          <rect width="24" height="2.4" y="13.6" fill="#d01c1f" />
          <path d="M8.5 7.5 A3.8 3.8 0 0 0 15.5 7.5 A3.2 2.4 0 0 1 8.5 7.5 Z" fill="#ffc400" />
          {star(12, 6.2, 1.4, '#ffc400')}
        </>
      );
    case 'CF':
      return (
        <>
          <rect width="24" height="4" y="0" fill="#003082" />
          <rect width="24" height="4" y="4" fill="#ffffff" />
          <rect width="24" height="4" y="8" fill="#289728" />
          <rect width="24" height="4" y="12" fill="#ffce00" />
          <rect x="10.2" y="0" width="3.6" height="16" fill="#d21034" />
          {star(4, 2, 1.3, '#ffce00')}
        </>
      );
    case 'EG':
      return hTri('#ce1126', '#ffffff', '#111111', <circle cx="12" cy="8" r="1.4" fill="#c09300" />);
    case 'NE':
      return hTri('#e05206', '#ffffff', '#0db02b', <circle cx="12" cy="8" r="1.9" fill="#e05206" />);
    case 'KM':
      return (
        <>
          <rect width="24" height="4" y="0" fill="#ffc61e" />
          <rect width="24" height="4" y="4" fill="#ffffff" />
          <rect width="24" height="4" y="8" fill="#ce1126" />
          <rect width="24" height="4" y="12" fill="#3a75c4" />
          <polygon points="0,0 11,8 0,16" fill="#3d8e33" />
          <circle cx="3.8" cy="8" r="2.1" fill="#ffffff" />
          <circle cx="4.6" cy="8" r="1.8" fill="#3d8e33" />
        </>
      );
    case 'ZM':
      return (
        <>
          <rect width="24" height="16" fill="#198a00" />
          <rect x="15" y="7" width="3" height="9" fill="#de2010" />
          <rect x="18" y="7" width="3" height="9" fill="#111111" />
          <rect x="21" y="7" width="3" height="9" fill="#ef7d00" />
          <rect x="16.5" y="3.2" width="5.5" height="1.6" rx="0.6" fill="#ef7d00" />
        </>
      );
    case 'CG':
      return (
        <>
          <polygon points="0,0 17,0 0,16" fill="#009543" />
          <polygon points="24,16 7,16 24,0" fill="#dc241f" />
          <polygon points="17,0 24,0 7,16 0,16" fill="#fbde4a" />
        </>
      );
    case 'BJ':
      return (
        <>
          <rect width="15" height="8" x="9" y="0" fill="#fcd116" />
          <rect width="15" height="8" x="9" y="8" fill="#e8112d" />
          <rect width="9" height="16" x="0" y="0" fill="#008751" />
        </>
      );
    case 'CV':
      return (
        <>
          <rect width="24" height="16" fill="#003893" />
          <rect width="24" height="3.2" y="8.2" fill="#ffffff" />
          <rect width="24" height="1.4" y="9.1" fill="#cf2027" />
          <circle cx="9.2" cy="9.8" r="3" fill="none" stroke="#f7d116" strokeWidth="0.9" strokeDasharray="1.1 1" />
        </>
      );
    case 'GQ':
      return (
        <>
          {hTri('#3e9a00', '#ffffff', '#e32118')}
          <polygon points="0,0 7.5,8 0,16" fill="#0073ce" />
        </>
      );
    case 'SL':
      return hTri('#1eb53a', '#ffffff', '#0072c6');
    case 'MZ':
      return (
        <>
          <rect width="24" height="5" y="0" fill="#007168" />
          <rect width="24" height="0.8" y="5" fill="#ffffff" />
          <rect width="24" height="4.4" y="5.8" fill="#111111" />
          <rect width="24" height="0.8" y="10.2" fill="#ffffff" />
          <rect width="24" height="5" y="11" fill="#fce100" />
          <polygon points="0,0 10,8 0,16" fill="#d21034" />
          {star(3.8, 8, 2, '#fce100')}
        </>
      );
    case 'BI':
      return (
        <>
          <rect width="24" height="16" fill="#1eb53a" />
          <polygon points="0,0 12,8 24,0" fill="#ce1126" />
          <polygon points="0,16 12,8 24,16" fill="#ce1126" />
          <line x1="0" y1="0" x2="24" y2="16" stroke="#ffffff" strokeWidth="2.2" />
          <line x1="24" y1="0" x2="0" y2="16" stroke="#ffffff" strokeWidth="2.2" />
          <circle cx="12" cy="8" r="3.4" fill="#ffffff" />
          <circle cx="12" cy="6.6" r="0.7" fill="#ce1126" />
          <circle cx="10.8" cy="8.9" r="0.7" fill="#ce1126" />
          <circle cx="13.2" cy="8.9" r="0.7" fill="#ce1126" />
        </>
      );
    case 'TZ':
      return (
        <>
          <polygon points="0,0 24,0 0,16" fill="#1eb53a" />
          <polygon points="24,16 24,0 0,16" fill="#00a3dd" />
          <line x1="0" y1="16" x2="24" y2="0" stroke="#fcd116" strokeWidth="5.2" />
          <line x1="0" y1="16" x2="24" y2="0" stroke="#111111" strokeWidth="3.4" />
        </>
      );
    case 'MG':
      return (
        <>
          <rect width="8" height="16" x="0" y="0" fill="#ffffff" />
          <rect width="16" height="8" x="8" y="0" fill="#fc3d32" />
          <rect width="16" height="8" x="8" y="8" fill="#007e3a" />
        </>
      );

    default:
      return (
        <>
          <rect width="24" height="16" fill="#334155" />
          <circle cx="12" cy="8" r="4" fill="none" stroke="#94a3b8" strokeWidth="1" />
        </>
      );
  }
}

export function CountryFlagSvg({
  code,
  nationality,
  size = 'sm',
  className = '',
  title,
}: CountryFlagSvgProps) {
  const key = resolveFlagKey(code, nationality);
  const { w, h } = SIZE_MAP[size];
  const label = title ?? nationality ?? code ?? '';

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 24 16"
      role="img"
      aria-label={label ? `${label} 국기` : '국기'}
      className={`inline-block shrink-0 rounded-[2px] ring-1 ring-white/15 align-middle ${className}`}
    >
      {label ? <title>{label}</title> : null}
      {renderFlagArtwork(key)}
    </svg>
  );
}
