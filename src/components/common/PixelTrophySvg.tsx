import type { LeagueId } from '../../types/league';

export type PixelTrophyVariant =
  | 'league'
  | 'epl_league'
  | 'laliga_league'
  | 'seriea_league'
  | 'bundesliga_league'
  | 'ligue1_league'
  | 'cup'
  | 'fa_cup'
  | 'copa_del_rey'
  | 'coppa_italia'
  | 'dfb_pokal'
  | 'coupe_de_france'
  | 'ucl'
  | 'ballon_dor';

interface PixelTrophySvgProps {
  variant: PixelTrophyVariant;
  size?: number;
  className?: string;
  animate?: boolean;
}

export function getLeagueTrophyVariant(
  leagueId: LeagueId | string,
): PixelTrophyVariant {
  switch (leagueId) {
    case 'epl':
      return 'epl_league';
    case 'laliga':
      return 'laliga_league';
    case 'seriea':
      return 'seriea_league';
    case 'bundesliga':
      return 'bundesliga_league';
    case 'ligue1':
      return 'ligue1_league';
    default:
      return 'league';
  }
}

export function getDomesticCupTrophyVariant(
  leagueId: LeagueId | string,
): PixelTrophyVariant {
  switch (leagueId) {
    case 'epl':
      return 'fa_cup';
    case 'laliga':
      return 'copa_del_rey';
    case 'seriea':
      return 'coppa_italia';
    case 'bundesliga':
      return 'dfb_pokal';
    case 'ligue1':
      return 'coupe_de_france';
    default:
      return 'fa_cup';
  }
}

interface Palette {
  O: string; // dark outline
  H: string; // bright highlight
  M: string; // main metallic tone
  S: string; // metallic shadow
  D: string; // deep shadow
  A: string; // accent 1 (gem / ribbon / gold trim)
  B: string; // accent 2 (base wood / plinth / secondary ribbon)
  P: string; // plinth highlight / plaque
  W: string; // specular white sparkle
}

const PALETTES: Record<PixelTrophyVariant, Palette> = {
  league: {
    O: '#141016',
    H: '#fef08a',
    M: '#f59e0b',
    S: '#d97706',
    D: '#92400e',
    A: '#38bdf8',
    B: '#262b36',
    P: '#fde047',
    W: '#ffffff',
  },
  epl_league: {
    O: '#141016',
    H: '#f8fafc',
    M: '#e2e8f0',
    S: '#94a3b8',
    D: '#475569',
    A: '#f59e0b', // Golden Crown & Trim
    B: '#1e1b4b', // Royal Purple/Navy Plinth
    P: '#10b981', // Premier Emerald Band
    W: '#ffffff',
  },
  laliga_league: {
    O: '#141016',
    H: '#ffffff',
    M: '#e2e8f0',
    S: '#94a3b8',
    D: '#475569',
    A: '#ef4444', // LaLiga Coral/Crimson Accent
    B: '#27272a',
    P: '#fbbf24', // Gold Plaque
    W: '#ffffff',
  },
  seriea_league: {
    O: '#141016',
    H: '#fef08a',
    M: '#facc15',
    S: '#ca8a04',
    D: '#854d0e',
    A: '#16a34a', // Italian Green Ring
    B: '#1e293b',
    P: '#ef4444', // Italian Red Ring
    W: '#ffffff',
  },
  bundesliga_league: {
    O: '#141016',
    H: '#f8fafc',
    M: '#cbd5e1',
    S: '#94a3b8',
    D: '#475569',
    A: '#f59e0b', // Tourmaline Gold Gems
    B: '#7f1d1d', // Bundesliga Crimson Core
    P: '#fde047',
    W: '#ffffff',
  },
  ligue1_league: {
    O: '#141016',
    H: '#fef08a',
    M: '#eab308',
    S: '#a16207',
    D: '#713f12',
    A: '#38bdf8', // Hexagoal Blue Accent
    B: '#1e293b',
    P: '#e2e8f0',
    W: '#ffffff',
  },
  cup: {
    O: '#141016',
    H: '#f8fafc',
    M: '#cbd5e1',
    S: '#94a3b8',
    D: '#475569',
    A: '#ef4444',
    B: '#3b2416',
    P: '#e2e8f0',
    W: '#ffffff',
  },
  fa_cup: {
    O: '#141016',
    H: '#f8fafc',
    M: '#cbd5e1',
    S: '#94a3b8',
    D: '#475569',
    A: '#dc2626',
    B: '#331f14',
    P: '#e2e8f0',
    W: '#ffffff',
  },
  copa_del_rey: {
    O: '#141016',
    H: '#f8fafc',
    M: '#d1d5db',
    S: '#9ca3af',
    D: '#4b5563',
    A: '#f59e0b',
    B: '#3c1e16',
    P: '#fbbf24',
    W: '#ffffff',
  },
  coppa_italia: {
    O: '#141016',
    H: '#fef08a',
    M: '#eab308',
    S: '#ca8a04',
    D: '#854d0e',
    A: '#16a34a',
    B: '#1e293b',
    P: '#f8fafc',
    W: '#ffffff',
  },
  dfb_pokal: {
    O: '#141016',
    H: '#fef08a',
    M: '#f59e0b',
    S: '#d97706',
    D: '#92400e',
    A: '#10b981',
    B: '#1b2622',
    P: '#34d399',
    W: '#ffffff',
  },
  coupe_de_france: {
    O: '#141016',
    H: '#f8fafc',
    M: '#cbd5e1',
    S: '#94a3b8',
    D: '#475569',
    A: '#2563eb',
    B: '#262030',
    P: '#ef4444',
    W: '#ffffff',
  },
  ucl: {
    O: '#141016',
    H: '#ffffff',
    M: '#dbeafe',
    S: '#94a3b8',
    D: '#475569',
    A: '#38bdf8',
    B: '#1e293b',
    P: '#e0f2fe',
    W: '#ffffff',
  },
  ballon_dor: {
    O: '#141016',
    H: '#fef9c3',
    M: '#facc15',
    S: '#d97706',
    D: '#78350f',
    A: '#b45309',
    B: '#3f3f46',
    P: '#71717a',
    W: '#ffffff',
  },
};

// 24x28 crisp pixel templates
const LEAGUE_GRID = [
  '........................',
  '........O..OO..O........',
  '.......OAOOHHOOAO.......',
  '.......OAAWWWWAAO.......',
  '......OOAAAAAAAHOO......',
  '......O.OHOOOOH.O.......',
  '....OOOOHWHMMMMSO.OOO...',
  '...OHO.OHWMMMMMSSO.OHO..',
  '..OHO..OHWMMMMMSSO..OHO.',
  '..OHO..OHMMMMMMSSO..OHO.',
  '...OHO..OHMMMMSSO..OHO..',
  '....OO..OHMMMMSSO..OO...',
  '.....OO..OHMMSSO..OO....',
  '......OO..OHMSO..OO.....',
  '.......OO..OHO..OO......',
  '........OOOHMSO.O.......',
  '..........OHMSO.........',
  '.........OOHMSOO........',
  '.........OAMMMSO........',
  '..........OHMSO.........',
  '........OOHMMMSOO.......',
  '.......OHMMMMMMSSO......',
  '......OOOOOOOOOOOO......',
  '.....OBBBBBBBBBBBBO.....',
  '.....OBBPPPPPPPPBBO.....',
  '....OBBBBBBBBBBBBBBO....',
  '....OOOOOOOOOOOOOOOO....',
  '........................',
];

// Bundesliga Meisterschale (Iconic Circular Shield Platter)
const MEISTERSCHALE_GRID = [
  '........................',
  '........OOOOOOOO........',
  '......OOHWWWWMMSSO......',
  '.....OHWMMAAAAMMSSSO....',
  '....OHWMMAOOOOAAMSSSO...',
  '...OHWMMAOOHHHOAMMSSSO..',
  '...OHWMMOHWAAAWOMMSSSO..',
  '..OHWMMOOWAAAAAOOMMSSSO.',
  '..OHWMMOHAAWPPAAOMMSSSO.',
  '..OHWMMOHAAWPPAAOMMSSSO.',
  '..OHWMMOOWAAAAAOOMMSSSO.',
  '...OHWMMOHWAAAWOMMSSSO..',
  '...OHWMMAOOHHHOAMMSSSO..',
  '....OHWMMAOOOOAAMSSSO...',
  '.....OHWMMAAAAMMSSSO....',
  '......OOHMMMMMMSSO......',
  '........OOOOOOOO........',
  '.........OOHMSOO........',
  '........OOHMMMSOO.......',
  '.......OOOOOOOOOOO......',
  '......OBBBBBBBBBBBO.....',
  '.....OBBBPPPPPPBBBBO....',
  '.....OBBBBBBBBBBBBBO....',
  '....OOOOOOOOOOOOOOOOO...',
  '........................',
  '........................',
  '........................',
  '........................',
];

// Ligue 1 Hexagoal (Modern Sculpted Hexagonal Crest Trophy)
const HEXAGOAL_GRID = [
  '........................',
  '........OOOOOOOO........',
  '.......OHWWWWMMSSO......',
  '......OHWMMMMMMSSSO.....',
  '.....OHWMMOOOOOMSSSO....',
  '....OHWMMOAAAAOOMSSSO...',
  '...OHWMMOAAWWAAOOMSSSO..',
  '...OHWMMOAAWWAAOOMSSSO..',
  '....OHWMMOAAAAOOMSSSO...',
  '.....OHWMMOOOOOMSSSO....',
  '......OHWMMMMMMSSSO.....',
  '.......OHMMMMMMSSO......',
  '........OHMMMMSSO.......',
  '.........OHMMSSO........',
  '.........OHMMSSO........',
  '........OHWMMMSSO.......',
  '.......OHWMMMMMSSO......',
  '......OHWMMMMMMMSSO.....',
  '......OOOOOOOOOOOO......',
  '.....OBBBBBBBBBBBBO.....',
  '.....OBBPPPPPPPPBBO.....',
  '....OBBBBBBBBBBBBBBO....',
  '....OOOOOOOOOOOOOOOO....',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
];

const FA_CUP_GRID = [
  '...........OO...........',
  '..........OHWO..........',
  '.........OHMMSO.........',
  '........OOHMMHOO........',
  '.......OOHWWWWHOO.......',
  '......OOOOOOOOOOOO......',
  '....OOOHWMMMMMMSSOOO....',
  '...OHOOHWMMMMMMSSOOHO...',
  '..OHO.OHWMMMMMMSSO.OHO..',
  '..OHO.OHMMMMMMMMSSO.OHO.',
  '..OHO..OHMMMMMMSSO..OHO.',
  '...OHO.OHMMMMMMSSO.OHO..',
  '....OHO.OHMMMMSSO.OHO...',
  '.....OO..OHMMSSO..OO....',
  '......OO..OHMSO..OO.....',
  '........O.OHMSO.O.......',
  '.........OAHMSAO........',
  '........OAAHMSAAO.......',
  '.........OOHMSOO........',
  '.........OHMMSSO........',
  '........OHMMMMSSO.......',
  '.......OOOOOOOOOOO......',
  '......OBBBBBBBBBBBO.....',
  '.....OBBBPPPPPPBBBBO....',
  '.....OBBBBBBBBBBBBBO....',
  '....OBBBBBBBBBBBBBBBO...',
  '....OOOOOOOOOOOOOOOOO...',
  '........................',
];

const DFB_POKAL_GRID = [
  '........................',
  '.....OOOOOOOOOOOOOO.....',
  '....OHWWWWMMMMMMSSSO....',
  '...OHWWMMMMMMMMMMSSSO...',
  '...OHWMMMMMMMMMMMSSSO...',
  '...OHWMMMMMMMMMMMSSSO...',
  '....OHMMMMMMMMMMSSSO....',
  '....OHMMMMMMMMMMSSSO....',
  '.....OHMMMMMMMMSSSO.....',
  '......OHMMMMMMSSSO......',
  '.......OHMMMMSSSO.......',
  '........OHMMSSSO........',
  '........OAAAAAAO........',
  '.......OAAWPPAAAO.......',
  '........OAAAAAAO........',
  '.........OHMSSO.........',
  '........OHMMSSSO........',
  '.......OHMMMMSSSO.......',
  '......OHMMMMMMSSSO......',
  '.....OOHMMMMMMSSSOO.....',
  '.....OHWMMMMMMMMSSO.....',
  '......OOOOOOOOOOOO......',
  '.....OBBBBBBBBBBBBO.....',
  '.....OBBPPPPPPPPBBO.....',
  '....OBBBBBBBBBBBBBBO....',
  '....OOOOOOOOOOOOOOOO....',
  '........................',
  '........................',
];

const UCL_GRID = [
  '........................',
  '....OO............OO....',
  '...OHHO..........OHHO...',
  '..OHO.OO.OOOOOO.OO.OHO..',
  '.OHO...OOHWWWWHOO...OHO.',
  '.OHO..OOHWMMMMSSOO..OHO.',
  '.OHO..OHWMMMMMMSSO..OHO.',
  '.OHO..OHWMMMMMMSSO..OHO.',
  '.OHO..OHMMMMMMMMSSO.OHO.',
  '..OHO.OHMMMMMMMMSSO.OHO.',
  '..OHO..OHMMMMMMSSO..OHO.',
  '...OHO.OHMMMMMMSSO.OHO..',
  '....OHO.OHMMMMSSO.OHO...',
  '.....OO..OHMMSSO..OO....',
  '......OO..OHMSO..OO.....',
  '........OOOHMSOOO.......',
  '..........OHMSO.........',
  '.........OOHMSOO........',
  '........OOHMMMSOO.......',
  '.......OHWMMMMMSSO......',
  '......OHWMMMMMMMSSO.....',
  '......OOOOOOOOOOOO......',
  '.....OBBBAAAAAABBBO.....',
  '.....OBBPPPPPPPPBBO.....',
  '....OBBBBBBBBBBBBBBO....',
  '....OOOOOOOOOOOOOOOO....',
  '........................',
  '........................',
];

const BALLON_DOR_GRID = [
  '........................',
  '.........OOOOOO.........',
  '.......OOHHHHHHOO.......',
  '......OHWWMMMMSSSO......',
  '.....OHWWMMOOMMSSSO.....',
  '....OHWMMOOAAOOMSSSO....',
  '....OHMMOOAAAAOOMSSO....',
  '...OHWMMOAAAAAOMMSSSO...',
  '...OHMMMSOAAAOSMMSSSO...',
  '...OHMMOOOMMMOOOMSSSO...',
  '...OHMOOAOMMMOAOOMSSO...',
  '...OHMOOAOMMMOAOOMSSO...',
  '....OHMMOOMMMOOMMSSO....',
  '....OHSMMMOOOMMMSSSO....',
  '.....OHSSMMOOMMSSSO.....',
  '......OHSSMMMMSSSO......',
  '.......OOHSSSSHOO.......',
  '.........OOOOOO.........',
  '........OOHMMSO.........',
  '.......OBBPPPPBBO.......',
  '......OBBBPPPPBBBO......',
  '.....OBBPPBBBBPPBBO.....',
  '....OBBBPBBBBBBPBBBO....',
  '....OBBBBBBBBBBBBBBO....',
  '...OBBBBBBBBBBBBBBBBO...',
  '...OOOOOOOOOOOOOOOOOO...',
  '........................',
  '........................',
];

function getGridForVariant(variant: PixelTrophyVariant): string[] {
  switch (variant) {
    case 'league':
    case 'epl_league':
      return LEAGUE_GRID;
    case 'laliga_league':
    case 'seriea_league':
      return DFB_POKAL_GRID;
    case 'bundesliga_league':
      return MEISTERSCHALE_GRID;
    case 'ligue1_league':
      return HEXAGOAL_GRID;
    case 'ucl':
      return UCL_GRID;
    case 'ballon_dor':
      return BALLON_DOR_GRID;
    case 'dfb_pokal':
      return DFB_POKAL_GRID;
    case 'fa_cup':
    case 'copa_del_rey':
    case 'coppa_italia':
    case 'coupe_de_france':
    case 'cup':
    default:
      return FA_CUP_GRID;
  }
}

export function PixelTrophySvg({
  variant,
  size = 64,
  className = '',
  animate = false,
}: PixelTrophySvgProps) {
  const palette = PALETTES[variant];
  const grid = getGridForVariant(variant);
  const cols = grid[0].length;
  const rows = grid.length;

  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  for (let y = 0; y < rows; y += 1) {
    const row = grid[y];
    let x = 0;
    while (x < cols) {
      const ch = row[x];
      if (ch === '.' || !(ch in palette)) {
        x += 1;
        continue;
      }
      let w = 1;
      while (x + w < cols && row[x + w] === ch) {
        w += 1;
      }
      rects.push({
        x,
        y,
        w,
        fill: palette[ch as keyof Palette],
      });
      x += w;
    }
  }

  return (
    <svg
      width={size}
      height={Math.round((size * rows) / cols)}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
      className={`pixel-crisp select-none ${animate ? 'pixel-float' : ''} ${className}`}
      aria-hidden="true"
    >
      {rects.map((r, idx) => (
        <rect
          key={idx}
          x={r.x}
          y={r.y}
          width={r.w}
          height={1}
          fill={r.fill}
        />
      ))}
    </svg>
  );
}
