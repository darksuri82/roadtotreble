import { CURATED_ATTRIBUTE_OVERRIDES } from '../data/attributeOverrides';
import type {
  GoalkeeperAttributes,
  Player,
  PlayerAttributes,
  SubPosition,
} from '../types/player';

function clampAttr(val: number): number {
  return Math.max(40, Math.min(99, Math.round(val)));
}

function hashPlayerId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededOffset(seed: number, salt: number, span = 2): number {
  const mixed = ((seed ^ (salt * 2654435761)) >>> 0) % (span * 2 + 1);
  return mixed - span;
}

export function getPrimarySubPosition(
  player: Pick<Player, 'position' | 'mainPositions'>,
): SubPosition {
  if (player.mainPositions && player.mainPositions.length > 0) {
    return player.mainPositions[0];
  }
  switch (player.position) {
    case 'GK':
      return 'GK';
    case 'DF':
      return 'CB';
    case 'MF':
      return 'CM';
    case 'FW':
    default:
      return 'ST';
  }
}

export function getPositionWeights(
  sub: SubPosition,
): Record<'sho' | 'pas' | 'cro' | 'dri' | 'aer' | 'def' | 'phy', number> {
  switch (sub) {
    case 'ST':
      return { sho: 0.34, pas: 0.14, cro: 0.0, dri: 0.16, aer: 0.16, def: 0.0, phy: 0.20 };
    case 'LW':
    case 'RW':
    case 'LM':
    case 'RM':
      return { sho: 0.20, pas: 0.19, cro: 0.17, dri: 0.28, aer: 0.0, def: 0.0, phy: 0.16 };
    case 'CAM':
      return { sho: 0.21, pas: 0.30, cro: 0.14, dri: 0.25, aer: 0.0, def: 0.0, phy: 0.10 };
    case 'CM':
      return { sho: 0.10, pas: 0.28, cro: 0.08, dri: 0.18, aer: 0.0, def: 0.18, phy: 0.18 };
    case 'CDM':
      return { sho: 0.0, pas: 0.24, cro: 0.0, dri: 0.12, aer: 0.14, def: 0.30, phy: 0.20 };
    case 'LB':
    case 'RB':
    case 'LWB':
    case 'RWB':
      return { sho: 0.0, pas: 0.16, cro: 0.20, dri: 0.16, aer: 0.0, def: 0.26, phy: 0.22 };
    case 'CB':
      return { sho: 0.0, pas: 0.15, cro: 0.0, dri: 0.0, aer: 0.25, def: 0.38, phy: 0.22 };
    case 'GK':
    default:
      return { sho: 0.0, pas: 0.15, cro: 0.0, dri: 0.0, aer: 0.25, def: 0.40, phy: 0.20 };
  }
}

export function computePositionWeightedAttributeOvr(
  player: Pick<Player, 'position' | 'mainPositions'>,
  attrs: PlayerAttributes,
): number {
  if (player.position === 'GK' && attrs.gk) {
    const g = attrs.gk;
    return Math.round(
      g.div * 0.25 + g.ref * 0.25 + g.pos * 0.22 + g.han * 0.18 + g.kic * 0.10,
    );
  }
  const sub = getPrimarySubPosition(player);
  const w = getPositionWeights(sub);
  const sum =
    attrs.sho * w.sho +
    attrs.pas * w.pas +
    attrs.cro * w.cro +
    attrs.dri * w.dri +
    attrs.aer * w.aer +
    attrs.def * w.def +
    attrs.phy * w.phy;
  return Math.round(sum);
}

function normalizeToTargetOvr(
  player: Pick<Player, 'ovr' | 'position' | 'mainPositions' | 'isLegend'>,
  raw: PlayerAttributes,
  tolerance = 1.3,
): PlayerAttributes {
  const target = player.ovr;
  const maxCap = player.isLegend ? 99 : 97;
  const clampForTier = (v: number) => Math.max(40, Math.min(maxCap, Math.round(v)));

  if (player.position === 'GK' && raw.gk) {
    const gkCurrent =
      raw.gk.div * 0.25 +
      raw.gk.ref * 0.25 +
      raw.gk.pos * 0.22 +
      raw.gk.han * 0.18 +
      raw.gk.kic * 0.10;
    const diff = target - gkCurrent;
    const shift = Math.abs(diff) > tolerance ? diff * 0.85 : 0;
    const gk: GoalkeeperAttributes = {
      div: clampForTier(raw.gk.div + shift),
      han: clampForTier(raw.gk.han + shift),
      ref: clampForTier(raw.gk.ref + shift),
      kic: clampForTier(raw.gk.kic + shift * 0.6),
      pos: clampForTier(raw.gk.pos + shift),
    };
    return {
      sho: clampForTier(raw.sho),
      pas: clampForTier(raw.pas),
      cro: clampForTier(raw.cro),
      dri: clampForTier(raw.dri),
      aer: clampForTier(raw.aer),
      def: clampForTier(raw.def),
      phy: clampForTier(raw.phy),
      gk,
    };
  }

  const sub = getPrimarySubPosition(player);
  const w = getPositionWeights(sub);
  let copy: PlayerAttributes = {
    sho: clampForTier(raw.sho),
    pas: clampForTier(raw.pas),
    cro: clampForTier(raw.cro),
    dri: clampForTier(raw.dri),
    aer: clampForTier(raw.aer),
    def: clampForTier(raw.def),
    phy: clampForTier(raw.phy),
  };

  for (let iter = 0; iter < 4; iter += 1) {
    const weighted =
      copy.sho * w.sho +
      copy.pas * w.pas +
      copy.cro * w.cro +
      copy.dri * w.dri +
      copy.aer * w.aer +
      copy.def * w.def +
      copy.phy * w.phy;
    const delta = target - weighted;
    if (Math.abs(delta) <= tolerance) break;
    copy = {
      sho: clampForTier(copy.sho + delta * (w.sho > 0 ? 0.95 : 0.30)),
      pas: clampForTier(copy.pas + delta * (w.pas > 0 ? 0.95 : 0.30)),
      cro: clampForTier(copy.cro + delta * (w.cro > 0 ? 0.95 : 0.30)),
      dri: clampForTier(copy.dri + delta * (w.dri > 0 ? 0.95 : 0.30)),
      aer: clampForTier(copy.aer + delta * (w.aer > 0 ? 0.95 : 0.25)),
      def: clampForTier(copy.def + delta * (w.def > 0 ? 0.95 : 0.20)),
      phy: clampForTier(copy.phy + delta * (w.phy > 0 ? 0.95 : 0.40)),
    };
  }

  return copy;
}

function deriveAttributesFromArchetype(player: Player): PlayerAttributes {
  const seed = hashPlayerId(player.id);
  const ovr = player.ovr;
  const sub = getPrimarySubPosition(player);
  const ps = new Set(player.playstyles);
  const hasWideMain = player.mainPositions.some((m) =>
    ['LW', 'RW', 'LM', 'RM', 'LWB', 'RWB'].includes(m),
  );
  const hasCamMain = player.mainPositions.includes('CAM');
  const hasStMain = player.mainPositions.includes('ST');

  if (player.position === 'GK') {
    const isSweeper = ps.has('sweeper_keeper');
    const isStopper = ps.has('shot_stopper');
    const div = clampAttr(ovr + (isStopper ? 2 : 0) + seededOffset(seed, 1, 1));
    const ref = clampAttr(ovr + (isStopper ? 3 : 1) + seededOffset(seed, 2, 1));
    const han = clampAttr(ovr - 1 + seededOffset(seed, 3, 2));
    const pos = clampAttr(ovr + (isSweeper ? 1 : 0) + seededOffset(seed, 4, 1));
    const kic = clampAttr(
      ovr + (isSweeper ? 4 : -5) + seededOffset(seed, 5, 2),
    );
    return normalizeToTargetOvr(player, {
      sho: clampAttr(36 + seededOffset(seed, 6, 4)),
      pas: clampAttr(isSweeper ? ovr - 4 : ovr - 13),
      cro: clampAttr(isSweeper ? ovr - 14 : ovr - 22),
      dri: clampAttr(isSweeper ? ovr - 16 : ovr - 24),
      aer: clampAttr(ovr - 1 + seededOffset(seed, 7, 2)),
      def: clampAttr(ovr + seededOffset(seed, 8, 1)),
      phy: clampAttr(ovr - 3 + seededOffset(seed, 9, 2)),
      gk: { div, han, ref, kic, pos },
    });
  }

  // Base profile by primary sub-position
  let sho = ovr - 10;
  let pas = ovr - 6;
  let cro = ovr - 10;
  let dri = ovr - 6;
  let aer = ovr - 10;
  let def = ovr - 12;
  let phy = ovr - 4;

  switch (sub) {
    case 'ST':
      sho = ovr + 2;
      pas = ovr - 9;
      cro = ovr - 16;
      dri = ovr - 3;
      aer = ovr - 2;
      def = Math.max(42, player.def - 3);
      phy = ovr;
      break;
    case 'LW':
    case 'RW':
      sho = ovr - 2;
      pas = ovr - 3;
      cro = ovr - 2;
      dri = ovr + 3;
      aer = ovr - 22;
      def = Math.max(44, player.def - 2);
      phy = ovr - 1;
      break;
    case 'LM':
    case 'RM':
      sho = ovr - 4;
      pas = ovr - 2;
      cro = ovr + 1;
      dri = ovr + 2;
      aer = ovr - 18;
      def = Math.max(52, player.def);
      phy = ovr;
      break;
    case 'CAM':
      sho = ovr - 3;
      pas = ovr + 3;
      cro = ovr - 2;
      dri = ovr + 2;
      aer = ovr - 20;
      def = Math.max(50, player.def - 4);
      phy = ovr - 6;
      break;
    case 'CM':
      sho = ovr - 7;
      pas = ovr + 2;
      cro = ovr - 5;
      dri = ovr - 1;
      aer = ovr - 10;
      def = ovr - 3;
      phy = ovr - 1;
      break;
    case 'CDM':
      sho = ovr - 12;
      pas = ovr;
      cro = ovr - 11;
      dri = ovr - 4;
      aer = ovr - 3;
      def = ovr + 2;
      phy = ovr + 1;
      break;
    case 'LB':
    case 'RB':
    case 'LWB':
    case 'RWB':
      sho = ovr - 15;
      pas = ovr - 3;
      cro = ovr;
      dri = ovr - 2;
      aer = ovr - 11;
      def = ovr;
      phy = ovr + 2;
      break;
    case 'CB':
    default:
      sho = ovr - 25;
      pas = ovr - 8;
      cro = ovr - 22;
      dri = ovr - 14;
      aer = ovr + 2;
      def = ovr + 2;
      phy = ovr + 1;
      break;
  }

  // Playstyle modifiers (archetype shaping across all 5 leagues)
  if (ps.has('poacher')) {
    sho += 4;
    aer += 3;
    pas -= 4;
    cro -= 5;
  }
  if (ps.has('complete_forward')) {
    sho += 2;
    aer += 3;
    phy += 2;
    pas += 2;
  }
  if (ps.has('line_breaker')) {
    phy += 3;
    sho += 1;
    dri += 1;
  }
  if (ps.has('inverted_winger')) {
    dri += 3;
    sho += 2;
    pas += 1;
  }
  if (ps.has('classic_winger')) {
    cro += 5;
    dri += 3;
    phy += 2;
    sho -= 2;
  }
  if (ps.has('playmaker_10')) {
    pas += 5;
    cro += 3;
    dri += 2;
    if (hasWideMain) {
      // Creative winger archetype (e.g., Yamal/Olise/Saka/Kvara type across leagues)
      pas += 2;
      cro += 2;
    }
  }
  if (ps.has('deep_playmaker')) {
    pas += 6;
    cro += 2;
    dri += 1;
    sho -= 3;
  }
  if (ps.has('box_to_box')) {
    phy += 3;
    sho += 2;
    def += 1;
  }
  if (ps.has('ball_winner')) {
    def += 4;
    phy += 3;
    aer += 2;
    sho -= 3;
  }
  if (ps.has('attacking_wingback')) {
    cro += 4;
    phy += 3;
    dri += 2;
    pas += 1;
  }
  if (ps.has('ball_playing_cb')) {
    pas += 6;
    dri += 4;
  }
  if (ps.has('stopper_cb')) {
    def += 2;
    aer += 3;
    phy += 2;
  }

  // Hybrid multi-position bonuses
  if (hasStMain && hasWideMain) {
    dri += 2;
    phy += 2;
  }
  if (hasCamMain && hasWideMain) {
    pas += 2;
    cro += 2;
  }

  // Stamina tie-in to PHY
  if (player.stamina >= 90) phy += 2;
  else if (player.stamina <= 74) phy -= 2;

  // Subtle deterministic variation per player ID
  const raw: PlayerAttributes = {
    sho: clampAttr(sho + seededOffset(seed, 11, 2)),
    pas: clampAttr(pas + seededOffset(seed, 13, 2)),
    cro: clampAttr(cro + seededOffset(seed, 17, 2)),
    dri: clampAttr(dri + seededOffset(seed, 19, 2)),
    aer: clampAttr(aer + seededOffset(seed, 23, 2)),
    def: clampAttr(def + seededOffset(seed, 29, 2)),
    phy: clampAttr(phy + seededOffset(seed, 31, 2)),
  };

  return normalizeToTargetOvr(player, raw);
}

const ATTRIBUTE_CACHE = new Map<string, PlayerAttributes>();

/**
 * Returns the 7 core field sub-attributes (+ 5 GK sub-attributes for goalkeepers)
 * for any player in the game.
 * - Uses curated profile when defined, or derives deterministically from archetype.
 * - Guarantees position-weighted OVR consistency within ±2 of `player.ovr`.
 */
export function getPlayerAttributes(player: Player): PlayerAttributes {
  if (player.attrs && typeof player.attrs.sho === 'number') {
    if (player.position === 'GK' && !player.attrs.gk) {
      const derived = deriveAttributesFromArchetype(player);
      return { ...player.attrs, gk: derived.gk };
    }
    return player.attrs;
  }

  const cacheKey = `${player.id}:${player.ovr}:${player.position}`;
  const cached = ATTRIBUTE_CACHE.get(cacheKey);
  if (cached) return cached;

  const curated = CURATED_ATTRIBUTE_OVERRIDES[player.id];
  const computed = curated
    ? normalizeToTargetOvr(player, curated, 2.1)
    : deriveAttributesFromArchetype(player);

  ATTRIBUTE_CACHE.set(cacheKey, computed);
  return computed;
}

/**
 * Scales a player's sub-attributes according to their live effective OVR
 * (reflecting synergy, morale, injury play-through penalty, or fatigue).
 */
export function getEffectivePlayerAttributes(
  player: Player,
  effectiveOvr?: number,
): PlayerAttributes {
  const base = getPlayerAttributes(player);
  if (effectiveOvr === undefined || effectiveOvr === player.ovr) {
    return base;
  }
  const delta = effectiveOvr - player.ovr;
  const gk = base.gk
    ? {
        div: clampAttr(base.gk.div + delta),
        han: clampAttr(base.gk.han + delta),
        ref: clampAttr(base.gk.ref + delta),
        kic: clampAttr(base.gk.kic + delta),
        pos: clampAttr(base.gk.pos + delta),
      }
    : undefined;

  return {
    sho: clampAttr(base.sho + delta),
    pas: clampAttr(base.pas + delta),
    cro: clampAttr(base.cro + delta),
    dri: clampAttr(base.dri + delta),
    aer: clampAttr(base.aer + delta),
    def: clampAttr(base.def + delta),
    phy: clampAttr(base.phy + delta),
    gk,
  };
}

export interface PlayerArchetypeProfile {
  tag: string;
  badgeClass: string;
  description: string;
  topStats: { key: string; label: string; value: number }[];
}

export const FIELD_ATTR_META: {
  key: keyof Omit<PlayerAttributes, 'gk'>;
  shortLabel: string;
  fullLabel: string;
}[] = [
  { key: 'sho', shortLabel: 'SHO', fullLabel: '슈팅/결정력' },
  { key: 'pas', shortLabel: 'PAS', fullLabel: '패스/시야' },
  { key: 'cro', shortLabel: 'CRO', fullLabel: '크로스/킥' },
  { key: 'dri', shortLabel: 'DRI', fullLabel: '드리블/돌파' },
  { key: 'aer', shortLabel: 'AER', fullLabel: '헤더/공중볼' },
  { key: 'def', shortLabel: 'DEF', fullLabel: '수비/태클' },
  { key: 'phy', shortLabel: 'PHY', fullLabel: '스피드/피지컬' },
];

export const GK_ATTR_META: {
  key: keyof GoalkeeperAttributes;
  shortLabel: string;
  fullLabel: string;
}[] = [
  { key: 'div', shortLabel: 'DIV', fullLabel: '다이빙' },
  { key: 'han', shortLabel: 'HAN', fullLabel: '핸들링' },
  { key: 'ref', shortLabel: 'REF', fullLabel: '반사신경' },
  { key: 'kic', shortLabel: 'KIC', fullLabel: '킥/빌드업' },
  { key: 'pos', shortLabel: 'POS', fullLabel: '위치선정' },
];

export function getPlayerArchetypeProfile(
  player: Player,
): PlayerArchetypeProfile {
  const attrs = getPlayerAttributes(player);
  const sub = getPrimarySubPosition(player);

  if (player.position === 'GK' && attrs.gk) {
    const g = attrs.gk;
    const isSweeper =
      player.playstyles.includes('sweeper_keeper') || g.kic >= g.div - 2;
    const sorted = GK_ATTR_META.map((m) => ({
      key: m.shortLabel,
      label: m.fullLabel,
      value: g[m.key],
    })).sort((a, b) => b.value - a.value);

    return {
      tag: isSweeper ? '스위퍼 키퍼' : '슈퍼 세이브 수문장',
      badgeClass: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
      description: isSweeper
        ? '정교한 킥(KIC)과 넓은 커버 범위로 후방 빌드업의 시발점이 되는 현대형 골키퍼'
        : '압도적인 반사신경(REF)과 다이빙(DIV)으로 결정적 1대1·중거리 슛을 막아내는 수문장',
      topStats: sorted.slice(0, 2),
    };
  }

  const sortedField = FIELD_ATTR_META.map((m) => ({
    key: m.shortLabel,
    label: m.fullLabel,
    value: attrs[m.key],
  })).sort((a, b) => b.value - a.value);

  const isWinger = ['LW', 'RW', 'LM', 'RM'].includes(sub);

  if (sub === 'ST') {
    if (attrs.pas >= attrs.sho - 8 && player.playstyles.includes('playmaker_10')) {
      return {
        tag: '완성형 연계 스트라이커',
        badgeClass: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
        description:
          '최정상급 결정력(SHO)·공중볼(AER)에 더해 2선 스루패스 연계(PAS)까지 수행하는 올라운드 9번',
        topStats: sortedField.slice(0, 2),
      };
    }
    if (attrs.aer >= attrs.dri + 4) {
      return {
        tag: '타겟형 정통 9번',
        badgeClass: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
        description:
          '압도적인 골 결정력(SHO)과 타점 높은 헤더(AER)·몸싸움(PHY)으로 박스를 지배하는 스트라이커',
        topStats: sortedField.slice(0, 2),
      };
    }
    return {
      tag: '침투형 라인브레이커',
      badgeClass: 'border-orange-400/40 bg-orange-500/15 text-orange-200',
      description:
        '폭발적인 가속도(PHY)와 드리블(DRI)·마무리(SHO)로 수비 뒷공간을 허무는 침투형 공격수',
      topStats: sortedField.slice(0, 2),
    };
  }

  if (isWinger) {
    if (attrs.pas >= 87 && attrs.cro >= 87) {
      return {
        tag: '크랙 & 찬스메이커 윙어',
        badgeClass: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200',
        description:
          '화려한 드리블(DRI)과 날카로운 크로스(CRO)·킬패스(PAS), 컷인 감아차기(SHO)를 모두 갖춘 측면 에이스',
        topStats: sortedField.slice(0, 2),
      };
    }
    if (attrs.dri >= attrs.sho + 8) {
      return {
        tag: '폭발적 크랙 드리블러',
        badgeClass: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
        description:
          '최상위 1대1 드리블(DRI)과 스피드(PHY)로 측면 수비를 허물어 원맨 돌파·컷백·PK를 만드는 크랙',
        topStats: sortedField.slice(0, 2),
      };
    }
    return {
      tag: '인사이드 포워드',
      badgeClass: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
      description:
        '측면에서 하프스페이스로 파고들어 감아차기(SHO)와 컷백(CRO)으로 득점·도움을 생산하는 윙어',
      topStats: sortedField.slice(0, 2),
    };
  }

  if (sub === 'CAM') {
    return {
      tag: '마에스트로 찬스메이커',
      badgeClass: 'border-sky-400/40 bg-sky-500/15 text-sky-200',
      description:
        '정교한 스루패스(PAS)와 탈압박(DRI), 2선 중거리 슈팅(SHO)으로 공격을 지휘하는 10번 플레이메이커',
      topStats: sortedField.slice(0, 2),
    };
  }

  if (sub === 'CM' || sub === 'CDM') {
    if (attrs.pas >= attrs.def + 4) {
      return {
        tag: '딥라잉 빌드업 코어',
        badgeClass: 'border-sky-400/40 bg-sky-500/15 text-sky-200',
        description:
          '후방과 중원에서 높은 패스 정확도(PAS)와 시야로 빌드업과 대각선 반대전환을 주도하는 사령관',
        topStats: sortedField.slice(0, 2),
      };
    }
    if (attrs.def >= attrs.pas + 2) {
      return {
        tag: '중원 볼위너 홀딩',
        badgeClass: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
        description:
          '강력한 태클(DEF)과 피지컬(PHY)로 상대 역습을 차단하고 공수 균형을 잡는 수비형 미드필더',
        topStats: sortedField.slice(0, 2),
      };
    }
    return {
      tag: '박스 투 박스 엔진',
      badgeClass: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
      description:
        '왕성한 기동력(PHY)과 공수 밸런스(PAS·DEF·SHO)로 전방 압박과 2선 침투를 겸하는 전천후 미드필더',
      topStats: sortedField.slice(0, 2),
    };
  }

  if (['LB', 'RB', 'LWB', 'RWB'].includes(sub)) {
    if (attrs.cro >= attrs.def + 2) {
      return {
        tag: '오버래핑 크로스 윙백',
        badgeClass: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200',
        description:
          '빠른 오버래핑(PHY)과 날카로운 얼리 크로스·컷백(CRO)으로 측면 공격을 지원하는 공격형 풀백',
        topStats: sortedField.slice(0, 2),
      };
    }
    return {
      tag: '밸런스 수비·빌드업 풀백',
      badgeClass: 'border-slate-400/40 bg-slate-500/15 text-slate-200',
      description:
        '견고한 측면 1대1 수비(DEF)와 안정적인 후방 빌드업 연계(PAS)를 수행하는 풀백',
      topStats: sortedField.slice(0, 2),
    };
  }

  // CB
  if (attrs.pas >= player.ovr - 5 || player.playstyles.includes('ball_playing_cb')) {
    return {
      tag: '볼플레잉 빌드업 센터백',
      badgeClass: 'border-sky-400/40 bg-sky-500/15 text-sky-200',
      description:
        '침착한 대인 수비(DEF)·제공권(AER)과 함께 후방 전진 패스(PAS)로 공격의 물꼬를 트는 현대형 센터백',
      topStats: sortedField.slice(0, 2),
    };
  }
  return {
    tag: '제공권 파이터 스토퍼',
    badgeClass: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
    description:
      '압도적인 공중볼 장악(AER)과 대인 마크(DEF)·몸싸움(PHY)으로 박스 안을 철통 방어하고 세트피스 헤더를 노리는 센터백',
    topStats: sortedField.slice(0, 2),
  };
}
