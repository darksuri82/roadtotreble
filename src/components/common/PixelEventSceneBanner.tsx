import type {
  ManagerEventSceneId,
  PositionGroupId,
} from '../../types/condition';
import type { ManagerAvatarConfig, UserClubProfile } from '../../types/game';
import { DEFAULT_MANAGER_AVATAR } from '../../types/game';
import type { Position, SubPosition } from '../../types/player';
import { CountryFlagSvg } from './CountryFlagSvg';
import { PixelManagerAvatar } from './PixelManagerAvatar';
import { PixelStatusIcon } from './PixelStatusIcon';

export const SCENE_META: Record<
  ManagerEventSceneId,
  { label: string; icon: string; accentClass: string }
> = {
  press_official: {
    label: '공식 기자회견장',
    icon: '🎙️',
    accentClass: 'border-sky-400/40 bg-sky-950/80 text-sky-200',
  },
  press_ucl_night: {
    label: '빅매치 야간 기자회견장',
    icon: '⭐',
    accentClass: 'border-indigo-400/45 bg-indigo-950/85 text-indigo-200',
  },
  press_mixed_zone: {
    label: '믹스트존 플래시 인터뷰',
    icon: '🏟️',
    accentClass: 'border-emerald-400/40 bg-emerald-950/80 text-emerald-200',
  },
  locker_home: {
    label: '홈 라커룸 전체 미팅',
    icon: '👕',
    accentClass: 'border-amber-400/40 bg-amber-950/80 text-amber-200',
  },
  stadium_tunnel: {
    label: '경기장 출전 터널',
    icon: '🚪',
    accentClass: 'border-rose-400/45 bg-rose-950/80 text-rose-200',
  },
  manager_office: {
    label: '감독실 1:1 면담실',
    icon: '💼',
    accentClass: 'border-amber-300/40 bg-slate-900/90 text-amber-200',
  },
  training_pitch: {
    label: '훈련장 피치',
    icon: '⚽',
    accentClass: 'border-emerald-400/45 bg-emerald-950/80 text-emerald-200',
  },
  celebration_locker: {
    label: '승리 환호 라커룸',
    icon: '🎉',
    accentClass: 'border-yellow-400/50 bg-amber-950/85 text-yellow-200',
  },
};

interface PixelEventSceneBannerProps {
  sceneId: ManagerEventSceneId;
  managerAvatar?: ManagerAvatarConfig;
  managerName?: string;
  userClub?: UserClubProfile;
  targetScope?: 'team' | 'position_group' | 'player';
  positionGroup?: PositionGroupId;
  targetPlayer?: {
    name: string;
    nationality?: string;
    nationalityCode?: string;
    ovr?: number;
    position?: Position;
    mainPosition?: SubPosition;
    morale?: number;
    injured?: boolean;
  } | null;
  compact?: boolean;
}

function SceneBackgroundSvg({
  sceneId,
  primary,
  secondary,
}: {
  sceneId: ManagerEventSceneId;
  primary: string;
  secondary: string;
}) {
  switch (sceneId) {
    case 'press_official':
      return (
        <svg
          viewBox="0 0 160 64"
          preserveAspectRatio="xMidYMid slice"
          shapeRendering="crispEdges"
          className="h-full w-full"
          aria-hidden="true"
        >
          {/* Ceiling & spotlights */}
          <rect x="0" y="0" width="160" height="10" fill="#0b111c" />
          <rect x="20" y="2" width="12" height="3" fill="#38bdf8" opacity="0.7" />
          <rect x="74" y="2" width="12" height="3" fill="#f8fafc" opacity="0.85" />
          <rect x="128" y="2" width="12" height="3" fill="#38bdf8" opacity="0.7" />
          {/* Light beams */}
          <polygon points="22,5 30,5 42,64 10,64" fill="#38bdf8" opacity="0.07" />
          <polygon points="75,5 85,5 104,64 56,64" fill="#e2e8f0" opacity="0.09" />
          <polygon points="130,5 138,5 150,64 118,64" fill="#38bdf8" opacity="0.07" />

          {/* Sponsor Backdrop Wall */}
          <rect x="8" y="10" width="144" height="42" fill="#131d2e" />
          <rect x="8" y="10" width="144" height="3" fill={primary} />
          <rect x="8" y="13" width="144" height="1" fill={secondary} opacity="0.8" />
          {/* Repeating sponsor tile badges */}
          {[16, 40, 64, 88, 112, 136].map((x) => (
            <g key={`sp1-${x}`}>
              <rect x={x} y="18" width="16" height="5" fill="#1e2d44" />
              <rect x={x + 2} y="20" width="6" height="1" fill={primary} opacity="0.9" />
              <rect x={x + 9} y="20" width="5" height="1" fill="#94a3b8" opacity="0.7" />
              <rect x={x - 4} y="29" width="16" height="5" fill="#1a273c" />
              <rect x={x - 2} y="31" width="11" height="1" fill={secondary} opacity="0.55" />
              <rect x={x} y="40" width="16" height="5" fill="#1e2d44" />
              <rect x={x + 3} y="42" width="10" height="1" fill="#38bdf8" opacity="0.55" />
            </g>
          ))}
          {/* Side curtains */}
          <rect x="0" y="10" width="8" height="54" fill="#0d1522" />
          <rect x="152" y="10" width="8" height="54" fill="#0d1522" />
          {/* Floor */}
          <rect x="0" y="52" width="160" height="12" fill="#0c121e" />
          {/* Camera flashes */}
          <rect x="18" y="24" width="3" height="3" fill="#ffffff" opacity="0.9" />
          <rect x="19" y="22" width="1" height="7" fill="#e0f2fe" opacity="0.65" />
          <rect x="16" y="25" width="7" height="1" fill="#e0f2fe" opacity="0.65" />
          <rect x="139" y="19" width="2" height="2" fill="#ffffff" opacity="0.8" />
          <rect x="138" y="20" width="4" height="1" fill="#bae6fd" opacity="0.5" />
        </svg>
      );

    case 'press_ucl_night':
      return (
        <svg
          viewBox="0 0 160 64"
          preserveAspectRatio="xMidYMid slice"
          shapeRendering="crispEdges"
          className="h-full w-full"
          aria-hidden="true"
        >
          {/* Deep UCL midnight backdrop */}
          <rect x="0" y="0" width="160" height="64" fill="#070d24" />
          <rect x="0" y="0" width="160" height="52" fill="#0b1538" />
          {/* UCL Starball geometric bands */}
          <polygon points="0,0 50,0 24,52 0,52" fill="#132661" opacity="0.65" />
          <polygon points="110,0 160,0 160,52 132,52" fill="#132661" opacity="0.65" />
          <rect x="0" y="8" width="160" height="2" fill="#38bdf8" opacity="0.55" />
          <rect x="0" y="10" width="160" height="1" fill="#fbbf24" opacity="0.5" />
          {/* Pixel stars scattered across backdrop */}
          {[
            [18, 18], [32, 26], [22, 38], [46, 16], [56, 32],
            [104, 18], [118, 30], [134, 16], [142, 28], [126, 40],
          ].map(([sx, sy], idx) => (
            <g key={`star-${idx}`}>
              <rect x={sx} y={sy} width="2" height="2" fill="#e0f2fe" opacity="0.85" />
              <rect x={sx - 1} y={sy} width="4" height="1" fill="#38bdf8" opacity="0.45" />
              <rect x={sx} y={sy - 1} width="1" height="4" fill="#38bdf8" opacity="0.45" />
            </g>
          ))}
          {/* Center UCL crest halo */}
          <rect x="64" y="14" width="32" height="24" fill="#102052" />
          <rect x="65" y="15" width="30" height="1" fill="#60a5fa" opacity="0.5" />
          <rect x="76" y="20" width="8" height="8" fill="#1e3a8a" />
          <rect x="78" y="22" width="4" height="4" fill="#f8fafc" opacity="0.7" />
          {/* Spotlight beams */}
          <polygon points="12,0 22,0 56,64 28,64" fill="#38bdf8" opacity="0.08" />
          <polygon points="138,0 148,0 132,64 104,64" fill="#fbbf24" opacity="0.07" />
          {/* Broadcast camera silhouette on right */}
          <rect x="136" y="34" width="12" height="8" fill="#060a14" />
          <rect x="133" y="36" width="3" height="4" fill="#1e293b" />
          <rect x="145" y="35" width="2" height="2" fill="#ef4444" />
          <rect x="141" y="42" width="2" height="14" fill="#060a14" />
          {/* Floor */}
          <rect x="0" y="52" width="160" height="12" fill="#060b1c" />
        </svg>
      );

    case 'press_mixed_zone':
      return (
        <svg
          viewBox="0 0 160 64"
          preserveAspectRatio="xMidYMid slice"
          shapeRendering="crispEdges"
          className="h-full w-full"
          aria-hidden="true"
        >
          {/* Night stadium sky */}
          <rect x="0" y="0" width="160" height="24" fill="#070e1c" />
          {/* Stadium floodlight towers */}
          <rect x="14" y="4" width="14" height="7" fill="#e2e8f0" opacity="0.9" />
          <rect x="16" y="5" width="10" height="5" fill="#ffffff" />
          <rect x="19" y="11" width="3" height="14" fill="#1e293b" />
          <polygon points="14,11 28,11 48,64 0,64" fill="#bae6fd" opacity="0.08" />

          <rect x="132" y="4" width="14" height="7" fill="#e2e8f0" opacity="0.9" />
          <rect x="134" y="5" width="10" height="5" fill="#ffffff" />
          <rect x="138" y="11" width="3" height="14" fill="#1e293b" />
          <polygon points="132,11 146,11 160,64 112,64" fill="#bae6fd" opacity="0.08" />

          {/* Stadium stands & blurred crowd pixels */}
          <rect x="0" y="18" width="160" height="20" fill="#111a2b" />
          <rect x="0" y="22" width="160" height="1" fill="#1e293b" />
          <rect x="0" y="28" width="160" height="1" fill="#1e293b" />
          {[6, 14, 22, 34, 42, 54, 66, 78, 90, 102, 114, 124, 138, 148].map((cx, idx) => (
            <g key={`crowd-${idx}`}>
              <rect x={cx} y={20 + (idx % 3) * 4} width="3" height="3" fill={idx % 3 === 0 ? primary : idx % 2 === 0 ? '#94a3b8' : secondary} opacity="0.65" />
              <rect x={cx + 5} y={24 + ((idx + 1) % 3) * 3} width="2" height="2" fill="#e2e8f0" opacity="0.4" />
            </g>
          ))}
          {/* LED Touchline advertising board */}
          <rect x="0" y="38" width="160" height="7" fill="#0f172a" />
          <rect x="0" y="39" width="160" height="5" fill={primary} opacity="0.85" />
          <rect x="8" y="41" width="22" height="1" fill={secondary} />
          <rect x="46" y="41" width="26" height="1" fill="#ffffff" />
          <rect x="92" y="41" width="20" height="1" fill={secondary} />
          <rect x="128" y="41" width="24" height="1" fill="#ffffff" />

          {/* Stadium pitch turf */}
          <rect x="0" y="45" width="160" height="19" fill="#14532d" />
          <rect x="0" y="45" width="160" height="3" fill="#166534" />
          <rect x="0" y="52" width="160" height="4" fill="#15803d" opacity="0.45" />
          {/* Touchline chalk line */}
          <rect x="0" y="47" width="160" height="1" fill="#f8fafc" opacity="0.85" />
          {/* Flash interview backdrop board behind manager */}
          <rect x="52" y="16" width="56" height="30" fill="#0f1829" />
          <rect x="52" y="16" width="56" height="2" fill={primary} />
          <rect x="56" y="22" width="14" height="4" fill="#1e293b" />
          <rect x="74" y="22" width="14" height="4" fill="#1e293b" />
          <rect x="92" y="22" width="12" height="4" fill="#1e293b" />
          <rect x="60" y="31" width="14" height="4" fill="#1e293b" />
          <rect x="80" y="31" width="14" height="4" fill="#1e293b" />
        </svg>
      );

    case 'locker_home':
      return (
        <svg
          viewBox="0 0 160 64"
          preserveAspectRatio="xMidYMid slice"
          shapeRendering="crispEdges"
          className="h-full w-full"
          aria-hidden="true"
        >
          {/* Locker room wall & warm ceiling */}
          <rect x="0" y="0" width="160" height="50" fill="#171f2e" />
          <rect x="0" y="0" width="160" height="7" fill="#0d131f" />
          <rect x="26" y="3" width="20" height="2" fill="#fde68a" opacity="0.8" />
          <rect x="114" y="3" width="20" height="2" fill="#fde68a" opacity="0.8" />

          {/* Left lockers with hanging team jerseys */}
          {[8, 28, 48].map((lx, idx) => (
            <g key={`lk-l-${idx}`}>
              <rect x={lx} y="10" width="17" height="38" fill="#232d40" />
              <rect x={lx + 1} y="11" width="15" height="36" fill="#111827" />
              <rect x={lx + 1} y="11" width="15" height="4" fill={primary} opacity="0.85" />
              {/* Hanging pixel jersey */}
              <rect x={lx + 5} y="18" width="7" height="10" fill={primary} />
              <rect x={lx + 3} y="18" width="2" height="4" fill={primary} />
              <rect x={lx + 12} y="18" width="2" height="4" fill={primary} />
              <rect x={lx + 7} y="20" width="3" height="6" fill={secondary} opacity="0.85" />
              {/* Locker bench seat */}
              <rect x={lx} y="43" width="17" height="4" fill="#78350f" />
              <rect x={lx} y="43" width="17" height="1" fill="#b45309" />
            </g>
          ))}

          {/* Center Tactical Whiteboard */}
          <rect x="70" y="12" width="46" height="28" fill="#cbd5e1" />
          <rect x="72" y="14" width="42" height="24" fill="#14532d" />
          {/* Pitch lines on whiteboard */}
          <rect x="92" y="14" width="1" height="24" fill="#dcfce7" opacity="0.6" />
          <rect x="72" y="21" width="6" height="10" fill="none" stroke="#dcfce7" strokeWidth="1" opacity="0.5" />
          <rect x="108" y="21" width="6" height="10" fill="none" stroke="#dcfce7" strokeWidth="1" opacity="0.5" />
          {/* Formation magnets */}
          <rect x="77" y="25" width="2" height="2" fill="#facc15" />
          <rect x="83" y="18" width="2" height="2" fill="#38bdf8" />
          <rect x="83" y="25" width="2" height="2" fill="#38bdf8" />
          <rect x="83" y="32" width="2" height="2" fill="#38bdf8" />
          <rect x="95" y="20" width="2" height="2" fill="#fb7185" />
          <rect x="95" y="30" width="2" height="2" fill="#fb7185" />
          <rect x="103" y="25" width="2" height="2" fill="#fb7185" />
          {/* Whiteboard marker tray */}
          <rect x="70" y="40" width="46" height="2" fill="#64748b" />

          {/* Right lockers */}
          {[122, 141].map((lx, idx) => (
            <g key={`lk-r-${idx}`}>
              <rect x={lx} y="10" width="16" height="38" fill="#232d40" />
              <rect x={lx + 1} y="11" width="14" height="36" fill="#111827" />
              <rect x={lx + 1} y="11" width="14" height="4" fill={primary} opacity="0.85" />
              <rect x={lx + 4} y="18" width="8" height="10" fill={primary} />
              <rect x={lx + 6} y="20" width="4" height="6" fill={secondary} opacity="0.85" />
              <rect x={lx} y="43" width="16" height="4" fill="#78350f" />
            </g>
          ))}

          {/* Floor */}
          <rect x="0" y="48" width="160" height="16" fill="#0f1520" />
          <rect x="0" y="48" width="160" height="1" fill="#334155" />
        </svg>
      );

    case 'stadium_tunnel':
      return (
        <svg
          viewBox="0 0 160 64"
          preserveAspectRatio="xMidYMid slice"
          shapeRendering="crispEdges"
          className="h-full w-full"
          aria-hidden="true"
        >
          {/* Dark concrete tunnel outer walls */}
          <rect x="0" y="0" width="160" height="64" fill="#090d16" />
          {/* Perspective tunnel walls */}
          <polygon points="0,0 56,12 56,50 0,64" fill="#141c2c" />
          <polygon points="160,0 104,12 104,50 160,64" fill="#141c2c" />
          {/* Club color accent stripes along tunnel walls */}
          <polygon points="0,24 56,26 56,30 0,32" fill={primary} opacity="0.8" />
          <polygon points="160,24 104,26 104,30 160,32" fill={primary} opacity="0.8" />
          <polygon points="0,33 56,31 56,32 0,35" fill={secondary} opacity="0.7" />
          <polygon points="160,33 104,31 104,32 160,35" fill={secondary} opacity="0.7" />

          {/* Bright stadium opening at tunnel end */}
          <rect x="56" y="12" width="48" height="38" fill="#1e3a5f" />
          <rect x="56" y="12" width="48" height="14" fill="#38bdf8" opacity="0.35" />
          {/* Blinding stadium floodlight glow */}
          <rect x="64" y="14" width="32" height="8" fill="#e0f2fe" opacity="0.85" />
          <rect x="70" y="15" width="20" height="5" fill="#ffffff" />
          {/* Distant stands & green pitch */}
          <rect x="56" y="26" width="48" height="10" fill="#1e293b" />
          <rect x="56" y="36" width="48" height="14" fill="#15803d" />
          <rect x="56" y="42" width="48" height="2" fill="#22c55e" opacity="0.5" />

          {/* Light cone spilling onto tunnel floor */}
          <polygon points="56,50 104,50 132,64 28,64" fill="#bae6fd" opacity="0.18" />

          {/* MATCHDAY neon header sign above tunnel */}
          <rect x="60" y="3" width="40" height="7" fill="#0f172a" />
          <rect x="61" y="4" width="38" height="5" fill={primary} opacity="0.9" />
          <rect x="66" y="6" width="28" height="1" fill="#ffffff" />

          {/* Tunnel ribbed ceiling lights */}
          <rect x="18" y="4" width="12" height="2" fill="#f8fafc" opacity="0.5" />
          <rect x="130" y="4" width="12" height="2" fill="#f8fafc" opacity="0.5" />
          {/* Concrete floor */}
          <rect x="0" y="50" width="160" height="14" fill="#111827" opacity="0.65" />
        </svg>
      );

    case 'manager_office':
      return (
        <svg
          viewBox="0 0 160 64"
          preserveAspectRatio="xMidYMid slice"
          shapeRendering="crispEdges"
          className="h-full w-full"
          aria-hidden="true"
        >
          {/* Warm wood-paneled office wall */}
          <rect x="0" y="0" width="160" height="52" fill="#1c1917" />
          <rect x="0" y="0" width="160" height="4" fill="#0c0a09" />
          {/* Vertical wood slat subtle lines */}
          {[12, 24, 36, 124, 136, 148].map((wx) => (
            <rect key={`wood-${wx}`} x={wx} y="4" width="1" height="48" fill="#292524" />
          ))}

          {/* Left Trophy Cabinet */}
          <rect x="8" y="10" width="34" height="36" fill="#292524" />
          <rect x="10" y="12" width="30" height="14" fill="#141210" />
          <rect x="10" y="28" width="30" height="14" fill="#141210" />
          {/* Pixel mini trophies inside cabinet */}
          <rect x="15" y="17" width="4" height="6" fill="#facc15" />
          <rect x="14" y="23" width="6" height="2" fill="#b45309" />
          <rect x="27" y="16" width="5" height="7" fill="#cbd5e1" />
          <rect x="26" y="23" width="7" height="2" fill="#475569" />
          {/* Tactical binders on lower shelf */}
          <rect x="13" y="33" width="4" height="8" fill={primary} />
          <rect x="18" y="34" width="4" height="7" fill="#38bdf8" />
          <rect x="23" y="33" width="4" height="8" fill="#22c55e" />
          <rect x="28" y="35" width="4" height="6" fill="#f59e0b" />

          {/* Center-Right Wide Window overlooking Stadium/Training Pitch */}
          <rect x="52" y="8" width="68" height="32" fill="#0f172a" />
          <rect x="54" y="10" width="64" height="16" fill="#1e293b" />
          <rect x="54" y="26" width="64" height="12" fill="#14532d" />
          <rect x="54" y="31" width="64" height="1" fill="#dcfce7" opacity="0.5" />
          {/* Distant floodlight */}
          <rect x="104" y="13" width="6" height="3" fill="#fde68a" opacity="0.85" />
          {/* Window mullions */}
          <rect x="85" y="8" width="2" height="32" fill="#292524" />
          <rect x="52" y="8" width="68" height="2" fill="#44403c" />
          <rect x="52" y="38" width="68" height="2" fill="#44403c" />

          {/* Right Framed Club Jersey / Tactics Board */}
          <rect x="128" y="12" width="24" height="28" fill="#292524" />
          <rect x="130" y="14" width="20" height="24" fill="#0f172a" />
          <rect x="136" y="19" width="8" height="12" fill={primary} />
          <rect x="134" y="19" width="2" height="5" fill={primary} />
          <rect x="144" y="19" width="2" height="5" fill={primary} />
          <rect x="138" y="22" width="4" height="6" fill={secondary} />

          {/* Warm desk lamp glow */}
          <polygon points="48,20 112,20 124,64 36,64" fill="#fbbf24" opacity="0.06" />
          {/* Floor */}
          <rect x="0" y="50" width="160" height="14" fill="#14110f" />
        </svg>
      );

    case 'training_pitch':
      return (
        <svg
          viewBox="0 0 160 64"
          preserveAspectRatio="xMidYMid slice"
          shapeRendering="crispEdges"
          className="h-full w-full"
          aria-hidden="true"
        >
          {/* Crisp daytime/golden-hour sky */}
          <rect x="0" y="0" width="160" height="28" fill="#0f2942" />
          <rect x="0" y="14" width="160" height="14" fill="#164e63" opacity="0.55" />
          {/* Pixel clouds */}
          <rect x="18" y="6" width="18" height="4" fill="#e0f2fe" opacity="0.25" />
          <rect x="22" y="4" width="10" height="2" fill="#e0f2fe" opacity="0.2" />
          <rect x="114" y="8" width="22" height="4" fill="#e0f2fe" opacity="0.22" />
          <rect x="120" y="6" width="10" height="2" fill="#e0f2fe" opacity="0.18" />

          {/* Training Clubhouse & trees silhouette */}
          <rect x="8" y="16" width="42" height="12" fill="#1e293b" />
          <rect x="8" y="16" width="42" height="2" fill={primary} opacity="0.85" />
          <rect x="14" y="20" width="6" height="4" fill="#38bdf8" opacity="0.45" />
          <rect x="24" y="20" width="6" height="4" fill="#38bdf8" opacity="0.45" />
          <rect x="34" y="20" width="6" height="4" fill="#38bdf8" opacity="0.45" />
          {/* Distant treeline */}
          {[56, 66, 78, 92, 106, 120, 134, 146].map((tx, idx) => (
            <rect
              key={`tree-${idx}`}
              x={tx}
              y={20 + (idx % 2) * 2}
              width="12"
              height={8 - (idx % 2) * 2}
              fill="#064e3b"
            />
          ))}

          {/* Green Training Pitch with mower stripes */}
          <rect x="0" y="28" width="160" height="36" fill="#15803d" />
          {[0, 32, 64, 96, 128].map((sx) => (
            <rect key={`strip-${sx}`} x={sx} y="28" width="16" height="36" fill="#16a34a" opacity="0.45" />
          ))}
          {/* Pitch white markings */}
          <rect x="0" y="34" width="160" height="1" fill="#f8fafc" opacity="0.7" />
          <rect x="0" y="54" width="160" height="1" fill="#f8fafc" opacity="0.4" />

          {/* Mini training goal on left */}
          <rect x="16" y="33" width="22" height="11" fill="none" stroke="#f8fafc" strokeWidth="1.5" />
          <rect x="17" y="34" width="20" height="9" fill="#ffffff" opacity="0.1" />

          {/* Orange training cones & football */}
          <polygon points="48,50 51,45 54,50" fill="#f97316" />
          <polygon points="108,48 111,43 114,48" fill="#f97316" />
          <polygon points="122,52 125,47 128,52" fill="#f97316" />
          <rect x="58" y="49" width="3" height="3" fill="#ffffff" />
          <rect x="59" y="50" width="1" height="1" fill="#0f172a" />

          {/* Portable Tactics Board on right */}
          <rect x="134" y="32" width="16" height="14" fill="#e2e8f0" />
          <rect x="135" y="33" width="14" height="12" fill="#14532d" />
          <rect x="138" y="37" width="2" height="2" fill="#facc15" />
          <rect x="144" y="40" width="2" height="2" fill="#38bdf8" />
          <rect x="141" y="46" width="2" height="8" fill="#475569" />
        </svg>
      );

    case 'celebration_locker':
    default:
      return (
        <svg
          viewBox="0 0 160 64"
          preserveAspectRatio="xMidYMid slice"
          shapeRendering="crispEdges"
          className="h-full w-full"
          aria-hidden="true"
        >
          {/* Warm festive locker room */}
          <rect x="0" y="0" width="160" height="50" fill="#1a1f2e" />
          <rect x="0" y="0" width="160" height="7" fill="#121420" />
          {/* Golden celebratory spotlights */}
          <polygon points="26,5 38,5 58,64 6,64" fill="#facc15" opacity="0.12" />
          <polygon points="74,5 86,5 110,64 50,64" fill="#fde047" opacity="0.14" />
          <polygon points="122,5 134,5 154,64 102,64" fill="#facc15" opacity="0.12" />

          {/* Left & Right Lockers with Team Jerseys */}
          {[10, 30, 114, 134].map((lx, idx) => (
            <g key={`cel-lk-${idx}`}>
              <rect x={lx} y="11" width="16" height="37" fill="#262e42" />
              <rect x={lx + 1} y="12" width="14" height="35" fill="#111827" />
              <rect x={lx + 1} y="12" width="14" height="4" fill={primary} />
              <rect x={lx + 4} y="19" width="8" height="10" fill={primary} />
              <rect x={lx + 6} y="21" width="4" height="6" fill={secondary} />
              <rect x={lx} y="43" width="16" height="4" fill="#92400e" />
            </g>
          ))}

          {/* Victory Banner Board in Center */}
          <rect x="54" y="13" width="52" height="24" fill="#0f172a" />
          <rect x="54" y="13" width="52" height="2" fill="#facc15" />
          <rect x="54" y="35" width="52" height="2" fill="#facc15" />
          <rect x="62" y="19" width="36" height="3" fill={primary} />
          <rect x="68" y="25" width="24" height="2" fill="#fde047" />
          <rect x="74" y="30" width="12" height="2" fill="#34d399" />

          {/* Pixel Confetti & Sparkles */}
          {[
            [18, 14, '#facc15'], [42, 20, '#34d399'], [58, 10, '#f472b6'],
            [70, 12, '#38bdf8'], [92, 9, '#facc15'], [108, 18, '#34d399'],
            [126, 12, '#facc15'], [144, 22, '#38bdf8'], [26, 30, '#fb7185'],
            [138, 32, '#fde047'], [48, 34, '#facc15'], [110, 32, '#f472b6'],
          ].map(([cx, cy, col], idx) => (
            <rect
              key={`conf-${idx}`}
              x={cx as number}
              y={cy as number}
              width="2"
              height="2"
              fill={col as string}
              opacity="0.9"
            />
          ))}

          {/* Floor */}
          <rect x="0" y="48" width="160" height="16" fill="#121622" />
          <rect x="0" y="48" width="160" height="1" fill="#facc15" opacity="0.35" />
        </svg>
      );
  }
}

function ForegroundDeskOverlay({
  sceneId,
  primary,
  secondary,
}: {
  sceneId: ManagerEventSceneId;
  primary: string;
  secondary: string;
}) {
  if (sceneId === 'press_official' || sceneId === 'press_ucl_night') {
    const isUcl = sceneId === 'press_ucl_night';
    return (
      <svg
        viewBox="0 0 160 28"
        preserveAspectRatio="xMidYMax meet"
        shapeRendering="crispEdges"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[44%] w-full"
        aria-hidden="true"
      >
        {/* Microphones sticking up from podium */}
        <rect x="64" y="2" width="1" height="9" fill="#94a3b8" />
        <rect x="62" y="0" width="5" height="4" fill={isUcl ? '#38bdf8' : primary} />
        <rect x="63" y="1" width="3" height="2" fill="#f8fafc" />

        <rect x="80" y="1" width="1" height="10" fill="#cbd5e1" />
        <rect x="78" y="0" width="5" height="4" fill="#1e293b" />
        <rect x="79" y="1" width="3" height="2" fill="#facc15" />

        <rect x="95" y="2" width="1" height="9" fill="#94a3b8" />
        <rect x="93" y="0" width="5" height="4" fill="#ef4444" />
        <rect x="94" y="1" width="3" height="2" fill="#ffffff" />

        {/* Water bottle on desk */}
        <rect x="108" y="4" width="3" height="7" fill="#bae6fd" opacity="0.8" />
        <rect x="108" y="3" width="3" height="1" fill="#38bdf8" />

        {/* Press Conference Table Front */}
        <rect x="34" y="11" width="92" height="17" fill={isUcl ? '#0b173d' : '#162032'} />
        <rect x="32" y="10" width="96" height="3" fill={isUcl ? '#1e3a8a' : '#263449'} />
        <rect x="34" y="13" width="92" height="2" fill={isUcl ? '#38bdf8' : primary} />
        <rect x="68" y="18" width="24" height="5" fill="#0f172a" opacity="0.7" />
        <rect x="71" y="20" width="18" height="1" fill={isUcl ? '#fbbf24' : secondary} />
      </svg>
    );
  }

  if (sceneId === 'manager_office') {
    return (
      <svg
        viewBox="0 0 160 24"
        preserveAspectRatio="xMidYMax meet"
        shapeRendering="crispEdges"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[36%] w-full"
        aria-hidden="true"
      >
        {/* Coffee mug & tactical notebook on desk */}
        <rect x="52" y="3" width="4" height="5" fill="#f8fafc" />
        <rect x="56" y="4" width="2" height="3" fill="#cbd5e1" />
        <rect x="96" y="5" width="14" height="3" fill="#15803d" />
        <rect x="98" y="6" width="10" height="1" fill="#dcfce7" />
        {/* Wooden Manager Desk */}
        <rect x="36" y="8" width="88" height="16" fill="#451a03" />
        <rect x="34" y="7" width="92" height="3" fill="#78350f" />
        <rect x="36" y="10" width="88" height="1" fill="#92400e" />
      </svg>
    );
  }

  return null;
}

export function PixelEventSceneBanner({
  sceneId,
  managerAvatar,
  managerName,
  userClub,
  targetScope = 'team',
  positionGroup,
  targetPlayer,
  compact = false,
}: PixelEventSceneBannerProps) {
  const meta = SCENE_META[sceneId] ?? SCENE_META.press_official;
  const primary = userClub?.primaryColor ?? '#10b981';
  const secondary = userClub?.secondaryColor ?? '#f8fafc';
  const avatar = managerAvatar ?? DEFAULT_MANAGER_AVATAR;

  const isDeskScene =
    sceneId === 'press_official' ||
    sceneId === 'press_ucl_night' ||
    sceneId === 'manager_office';

  const hasTargetPlayer = targetScope === 'player' && Boolean(targetPlayer?.name);

  return (
    <div
      className={`relative w-full overflow-hidden border-b border-slate-800 bg-[#090e16] ${
        compact ? 'h-24 sm:h-28' : 'h-36 sm:h-44'
      }`}
    >
      {/* Crisp Pixel Art Background Scene */}
      <div className="absolute inset-0">
        <SceneBackgroundSvg
          sceneId={sceneId}
          primary={primary}
          secondary={secondary}
        />
      </div>

      {/* Subtle Vignette for readability */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090e16]/85 via-transparent to-[#090e16]/45"
      />

      {/* Top-Left Scene Badge */}
      <div className="absolute top-2.5 left-3 z-20 flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold shadow-sm ${meta.accentClass}`}
        >
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
        </span>
        {userClub?.shortName && (
          <span className="hidden sm:inline-flex items-center rounded-md border border-slate-700/80 bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
            {userClub.name}
          </span>
        )}
      </div>

      {/* Top-Right Scope Pill (if team or position group) */}
      {!hasTargetPlayer && (
        <div className="absolute top-2.5 right-3 z-20">
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-950/85 px-2 py-0.5 text-[10px] font-bold text-slate-200">
            {targetScope === 'position_group'
              ? positionGroup === 'FW'
                ? '🎯 공격진 미팅'
                : positionGroup === 'MF'
                  ? '⚙️ 미드필더진 미팅'
                  : '🛡️ 수비진·GK 미팅'
              : '👥 팀 전체'}
          </span>
        </div>
      )}

      {/* Custom User Manager Pixel Avatar standing/sitting inside the Scene */}
      <div
        className={`absolute z-10 flex flex-col items-center transition-all ${
          hasTargetPlayer
            ? 'left-[28%] sm:left-[34%] -translate-x-1/2'
            : 'left-1/2 -translate-x-1/2'
        } ${isDeskScene ? 'bottom-1.5 sm:bottom-2' : 'bottom-2 sm:bottom-2.5'}`}
      >
        <div className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
          <PixelManagerAvatar
            avatar={avatar}
            clubPrimaryColor={primary}
            clubSecondaryColor={secondary}
            size={compact ? 58 : 82}
          />
        </div>
      </div>

      {/* Foreground Desk / Press Podium & Microphones layered over Manager's lower body */}
      <div
        className={`pointer-events-none absolute inset-0 z-[15] ${
          hasTargetPlayer ? '-translate-x-[16%] sm:-translate-x-[13%]' : ''
        }`}
      >
        <ForegroundDeskOverlay
          sceneId={sceneId}
          primary={primary}
          secondary={secondary}
        />
      </div>

      {/* Manager Nameplate at bottom-left */}
      {managerName && (
        <div className="absolute bottom-2 left-3 z-20 rounded-md border border-slate-700/80 bg-slate-950/85 px-2 py-0.5 text-[10px] font-bold text-slate-200">
          {managerName} 감독
        </div>
      )}

      {/* Right-Side Target Player Mini Card for 1:1 / Individual Player Events */}
      {hasTargetPlayer && targetPlayer && (
        <div className="absolute right-3 bottom-2.5 z-20 flex items-center gap-2 rounded-xl border border-emerald-400/45 bg-slate-950/90 px-2.5 py-2 shadow-xl max-w-[54%] sm:max-w-[230px]">
          <div className="flex flex-col items-center shrink-0 gap-1">
            <CountryFlagSvg
              code={targetPlayer.nationalityCode}
              nationality={targetPlayer.nationality}
              size="md"
            />
            {typeof targetPlayer.ovr === 'number' && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.2 font-mono text-[10px] font-black text-amber-300 border border-amber-400/35">
                {targetPlayer.ovr}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="rounded bg-slate-800 px-1 py-0.2 text-[9px] font-extrabold text-emerald-300">
                {targetPlayer.mainPosition ?? targetPlayer.position ?? 'PLY'}
              </span>
              {targetPlayer.injured && (
                <PixelStatusIcon variant="injury" size={12} />
              )}
              {typeof targetPlayer.morale === 'number' &&
                targetPlayer.morale >= 4 && (
                  <PixelStatusIcon variant="morale_high" size={12} />
                )}
              {typeof targetPlayer.morale === 'number' &&
                targetPlayer.morale <= -3 && (
                  <PixelStatusIcon variant="morale_low" size={12} />
                )}
            </div>
            <div className="truncate text-xs font-extrabold text-white mt-0.5">
              {targetPlayer.name}
            </div>
            <div className="text-[10px] text-slate-400">
              {typeof targetPlayer.morale === 'number'
                ? `현재 사기 ${targetPlayer.morale > 0 ? `+${targetPlayer.morale}` : targetPlayer.morale}`
                : '대상 선수'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
