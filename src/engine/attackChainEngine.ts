import type { FormationId, ManagerTraitId } from '../types/game';
import type {
  AttackRouteId,
  FinishTypeId,
  HighlightOutcomeType,
  HighlightPatternId,
  ShotAngleType,
  TacticId,
} from '../types/league';
import type { Player, SubPosition } from '../types/player';
import { getPlayerAttributes, getPrimarySubPosition } from './attributeEngine';

export interface AttackChainResult {
  pattern: HighlightPatternId;
  attackRoute: AttackRouteId;
  finishType: FinishTypeId;
  scorer: Player;
  assister: Player | null;
  secondaryShooter?: Player;
  contestDefender?: Player;
  dribbleBeatCount?: number;
  shotAngle: ShotAngleType;
  pkDirection?: 'left' | 'center' | 'right';
  reboundOrigin?: 'save' | 'woodwork' | 'blocked';
  xgDelta: number;
  description: string;
}

function pickWeightedItem<T>(
  entries: { item: T; weight: number }[],
  rng: () => number,
): T {
  const total = entries.reduce((acc, e) => acc + Math.max(0, e.weight), 0);
  if (total <= 0) return entries[0].item;
  let roll = rng() * total;
  for (const entry of entries) {
    const w = Math.max(0, entry.weight);
    if (roll < w) return entry.item;
    roll -= w;
  }
  return entries[entries.length - 1].item;
}

function fastAttr(p: Player) {
  return p.attrs ?? getPlayerAttributes(p);
}

export function mapPatternToAttackRoute(params: {
  pattern: HighlightPatternId;
  tactic: TacticId;
  roster: Player[];
  rng: () => number;
}): AttackRouteId {
  const { pattern, tactic, roster, rng } = params;
  let maxDri = 75;
  let maxShoMid = 75;
  for (let i = 0; i < roster.length; i += 1) {
    const p = roster[i];
    if (p.position === 'GK') continue;
    const a = fastAttr(p);
    if (a.dri > maxDri) maxDri = a.dri;
    if (p.position === 'MF' && a.sho > maxShoMid) maxShoMid = a.sho;
  }

  switch (pattern) {
    case 'wing_cross_header':
      return 'early_cross';
    case 'cutback_finish':
      return 'cutback';
    case 'through_ball_1v1':
      return 'through_ball';
    case 'cut_inside_curler': {
      // Branch into 3 authentic football routes:
      // 1) solo_dribble (원맨 드리블 돌파 쇼)
      // 2) cut_inside_curler (인버티드 컷인 감아차기)
      // 3) long_range_cannon (아크 정면 중거리 대포알 슈팅)
      const soloWeight =
        42 *
        (maxDri >= 93 ? 1.45 : maxDri >= 89 ? 1.2 : 0.9) *
        (tactic === 'counter' ? 1.25 : 1.0);
      const curlerWeight =
        40 * (tactic === 'possession' || tactic === 'wingplay' ? 1.2 : 1.0);
      const longShotWeight =
        26 * (maxShoMid >= 86 ? 1.35 : 1.0) * (tactic === 'balanced' ? 1.15 : 1.0);
      return pickWeightedItem<AttackRouteId>(
        [
          { item: 'solo_dribble', weight: soloWeight },
          { item: 'cut_inside_curler', weight: curlerWeight },
          { item: 'long_range_cannon', weight: longShotWeight },
        ],
        rng,
      );
    }
    case 'u_buildup_switch': {
      const tikiWeight =
        tactic === 'possession'
          ? 64
          : tactic === 'gegenpressing'
            ? 48
            : 38;
      const switchWeight =
        tactic === 'wingplay' ? 68 : 100 - tikiWeight;
      return rng() * (tikiWeight + switchWeight) < tikiWeight
        ? 'tiki_taka_triangle'
        : 'u_buildup_switch';
    }
    case 'high_press_counter': {
      if (tactic === 'gegenpressing') {
        return rng() < 0.78 ? 'gegenpress_steal' : 'low_block_counter';
      }
      if (tactic === 'counter') {
        return rng() < 0.76 ? 'low_block_counter' : 'gegenpress_steal';
      }
      return rng() < 0.52 ? 'gegenpress_steal' : 'low_block_counter';
    }
    case 'corner_kick':
      return 'corner_header';
    case 'direct_free_kick':
      return 'direct_fk';
    case 'rebound_finish':
      return 'rebound_poach';
    case 'penalty_kick':
    default:
      return 'penalty_kick';
  }
}

function getBoxPresenceMultiplier(sub: SubPosition, route: AttackRouteId): number {
  switch (route) {
    case 'early_cross':
      if (sub === 'ST') return 1.25;
      if (sub === 'LW' || sub === 'RW') return 0.78; // far-post winger header/volley
      if (sub === 'CAM') return 0.62;
      if (sub === 'CM' || sub === 'LM' || sub === 'RM') return 0.44;
      if (sub === 'CB') return 0.16;
      return 0.14;
    case 'corner_header':
      if (sub === 'CB') return 1.22;
      if (sub === 'ST') return 1.12;
      if (sub === 'CDM' || sub === 'CM') return 0.55;
      return 0.28;
    case 'cutback':
      if (sub === 'ST') return 1.12;
      if (sub === 'CAM') return 1.0;
      if (sub === 'LW' || sub === 'RW') return 0.96;
      if (sub === 'CM' || sub === 'LM' || sub === 'RM') return 0.68;
      return 0.20;
    case 'through_ball':
    case 'low_block_counter':
    case 'gegenpress_steal':
      if (sub === 'ST') return 1.16;
      if (sub === 'LW' || sub === 'RW') return 1.02;
      if (sub === 'CAM') return 0.78;
      if (sub === 'CM' || sub === 'LM' || sub === 'RM') return 0.46;
      return 0.16;
    case 'solo_dribble':
      if (sub === 'LW' || sub === 'RW') return 1.38;
      if (sub === 'CAM') return 1.12;
      if (sub === 'ST') return 0.92;
      if (sub === 'LM' || sub === 'RM' || sub === 'CM') return 0.62;
      if (sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB') return 0.38;
      return 0.10;
    case 'cut_inside_curler':
      if (sub === 'LW' || sub === 'RW') return 1.42;
      if (sub === 'CAM') return 1.10;
      if (sub === 'ST') return 0.85;
      if (sub === 'LM' || sub === 'RM' || sub === 'CM') return 0.62;
      return 0.14;
    case 'long_range_cannon':
      if (sub === 'CAM' || sub === 'CM') return 1.40;
      if (sub === 'CDM') return 0.96;
      if (sub === 'LW' || sub === 'RW') return 0.90;
      if (sub === 'ST') return 0.72;
      if (sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB') return 0.48;
      return 0.22;
    case 'tiki_taka_triangle':
    case 'u_buildup_switch':
      if (sub === 'ST') return 1.06;
      if (sub === 'LW' || sub === 'RW') return 1.12;
      if (sub === 'CAM') return 0.95;
      if (sub === 'CM' || sub === 'LM' || sub === 'RM') return 0.58;
      if (sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB') return 0.36;
      return 0.12;
    case 'rebound_poach':
      if (sub === 'ST') return 1.24;
      if (sub === 'LW' || sub === 'RW' || sub === 'CAM') return 0.90;
      if (sub === 'CM') return 0.56;
      return 0.22;
    case 'direct_fk':
      if (sub === 'CAM' || sub === 'LW' || sub === 'RW') return 1.28;
      if (sub === 'ST' || sub === 'CM') return 1.0;
      if (sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB') return 0.78;
      return 0.18;
    case 'penalty_kick':
    default:
      if (sub === 'ST') return 1.32;
      if (sub === 'LW' || sub === 'RW' || sub === 'CAM') return 1.0;
      if (sub === 'CM' || sub === 'CDM') return 0.48;
      return 0.12;
  }
}

export function pickChainScorer(params: {
  roster: Player[];
  route: AttackRouteId;
  freshSubIds: Set<string>;
  defendingRoster?: Player[];
  rng: () => number;
}): Player {
  const { roster, route, freshSubIds, defendingRoster, rng } = params;
  const outfield = roster.filter((p) => p.position !== 'GK');
  const pool = outfield.length > 0 ? outfield : roster;

  // Defensive line average attributes for contest scaling
  const defLine =
    defendingRoster?.filter((p) => p.position === 'DF' || p.position === 'MF') ?? [];
  const avgDefAer =
    defLine.length > 0
      ? defLine.reduce((s, p) => s + fastAttr(p).aer, 0) / defLine.length
      : 80;
  const avgDefTac =
    defLine.length > 0
      ? defLine.reduce((s, p) => s + fastAttr(p).def, 0) / defLine.length
      : 80;

  const weighted = pool.map((p) => {
    const attrs = fastAttr(p);
    const sub = getPrimarySubPosition(p);
    const boxMult = getBoxPresenceMultiplier(sub, route);
    const jokerBoost = freshSubIds.has(p.id) ? 1.52 : 1.0;

    let attrScore = 1.0;
    switch (route) {
      case 'early_cross': {
        const aerRatio = Math.max(45, attrs.aer) / Math.max(60, avgDefAer);
        const shoFactor = Math.pow(Math.max(45, attrs.sho) / 80, 1.75);
        const aerFactor = Math.pow(aerRatio, 1.85);
        attrScore = shoFactor * 0.48 + aerFactor * 0.52;
        if (p.playstyles.some((s) => ['poacher', 'complete_forward'].includes(s))) {
          attrScore *= 1.22;
        }
        break;
      }
      case 'corner_header': {
        const aerRatio = Math.max(45, attrs.aer) / Math.max(60, avgDefAer);
        attrScore =
          Math.pow(aerRatio, 2.2) *
          Math.pow(Math.max(45, attrs.phy) / 80, 1.15);
        if (p.playstyles.some((s) => ['stopper_cb', 'complete_forward', 'poacher'].includes(s))) {
          attrScore *= 1.24;
        }
        break;
      }
      case 'solo_dribble': {
        const driRatio = Math.max(45, attrs.dri) / Math.max(60, avgDefTac);
        attrScore =
          Math.pow(driRatio, 2.2) *
          Math.pow(Math.max(45, attrs.phy) / 80, 1.15) *
          Math.pow(Math.max(45, attrs.sho) / 80, 1.25);
        if (p.playstyles.some((s) => ['inverted_winger', 'classic_winger', 'line_breaker'].includes(s))) {
          attrScore *= 1.25;
        }
        break;
      }
      case 'cut_inside_curler': {
        attrScore =
          Math.pow(Math.max(45, attrs.dri) / 80, 1.65) *
          Math.pow(Math.max(45, attrs.sho) / 80, 1.85);
        if (p.playstyles.includes('inverted_winger')) attrScore *= 1.32;
        break;
      }
      case 'long_range_cannon': {
        attrScore =
          Math.pow(Math.max(45, attrs.sho) / 80, 2.15) *
          Math.pow(Math.max(45, attrs.pas) / 80, 0.8);
        if (p.playstyles.some((s) => ['box_to_box', 'playmaker_10'].includes(s))) {
          attrScore *= 1.28;
        }
        break;
      }
      case 'through_ball':
      case 'low_block_counter':
      case 'gegenpress_steal': {
        attrScore =
          Math.pow(Math.max(45, attrs.sho) / 80, 1.85) *
          Math.pow(Math.max(45, attrs.phy) / 80, 1.2) *
          Math.pow(Math.max(45, attrs.dri) / 80, 0.8);
        if (p.playstyles.some((s) => ['line_breaker', 'poacher', 'complete_forward'].includes(s))) {
          attrScore *= 1.22;
        }
        break;
      }
      case 'direct_fk': {
        const fkSkill = attrs.cro * 0.52 + attrs.sho * 0.48;
        attrScore = Math.pow(Math.max(45, fkSkill) / 82, 2.6);
        if (p.playstyles.includes('playmaker_10')) attrScore *= 1.3;
        break;
      }
      case 'penalty_kick': {
        const pkSkill = attrs.sho * 0.72 + p.ovr * 0.28;
        attrScore = Math.pow(Math.max(50, pkSkill) / 82, 2.6);
        if (p.playstyles.some((s) => ['complete_forward', 'poacher', 'playmaker_10'].includes(s))) {
          attrScore *= 1.28;
        }
        break;
      }
      case 'cutback':
      case 'tiki_taka_triangle':
      case 'u_buildup_switch':
      case 'rebound_poach':
      default: {
        attrScore =
          Math.pow(Math.max(45, attrs.sho) / 80, 1.95) *
          Math.pow(Math.max(45, attrs.dri) / 80, 0.7);
        if (p.playstyles.some((s) => ['poacher', 'complete_forward'].includes(s))) {
          attrScore *= 1.2;
        }
        break;
      }
    }

    return {
      item: p,
      weight: Math.max(0.01, boxMult * attrScore * jokerBoost),
    };
  });

  return pickWeightedItem(weighted, rng);
}

function getCreatorRoleMultiplier(sub: SubPosition, route: AttackRouteId): number {
  switch (route) {
    case 'early_cross':
      if (sub === 'LW' || sub === 'RW' || sub === 'LM' || sub === 'RM') return 1.55;
      if (sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB') return 1.38;
      if (sub === 'CAM') return 0.92;
      if (sub === 'CM') return 0.58;
      if (sub === 'ST') return 0.35;
      return 0.22;
    case 'cutback':
      if (sub === 'LW' || sub === 'RW' || sub === 'LM' || sub === 'RM') return 1.62;
      if (sub === 'CAM') return 1.15;
      if (sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB') return 1.10;
      if (sub === 'ST') return 0.65;
      if (sub === 'CM') return 0.62;
      return 0.18;
    case 'through_ball':
    case 'tiki_taka_triangle':
      if (sub === 'CAM') return 1.55;
      if (sub === 'LW' || sub === 'RW') return 1.38;
      if (sub === 'CM') return 1.12;
      if (sub === 'ST') return 0.82; // Complete 9 link-up play (Kane, Benzema, Alvarez)
      if (sub === 'CDM') return 0.78;
      if (sub === 'LM' || sub === 'RM') return 0.95;
      if (sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB') return 0.58;
      return 0.30;
    case 'u_buildup_switch':
      if (sub === 'CM' || sub === 'CDM') return 1.35;
      if (sub === 'CAM' || sub === 'LW' || sub === 'RW') return 1.25;
      if (sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB') return 1.15;
      if (sub === 'CB') return 0.72; // Ball-playing CB diagonal switch
      if (sub === 'ST') return 0.55;
      return 0.40;
    case 'gegenpress_steal':
    case 'low_block_counter':
      if (sub === 'CAM' || sub === 'LW' || sub === 'RW') return 1.35;
      if (sub === 'CM' || sub === 'CDM') return 1.15;
      if (sub === 'ST') return 0.85;
      if (sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB') return 0.80;
      return 0.35;
    case 'corner_header':
      if (sub === 'CAM' || sub === 'LW' || sub === 'RW' || sub === 'LM' || sub === 'RM') return 1.45;
      if (sub === 'CM' || sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB') return 1.20;
      if (sub === 'CDM') return 0.75;
      return 0.15;
    case 'cut_inside_curler':
    case 'long_range_cannon':
    case 'solo_dribble':
    default:
      if (sub === 'CAM' || sub === 'CM') return 1.30;
      if (sub === 'LW' || sub === 'RW') return 1.22;
      if (sub === 'ST' || sub === 'CDM') return 0.85;
      if (sub === 'LB' || sub === 'RB' || sub === 'LWB' || sub === 'RWB') return 0.78;
      return 0.30;
  }
}

export function pickChainAssister(params: {
  roster: Player[];
  scorerId: string;
  route: AttackRouteId;
  rng: () => number;
}): Player | null {
  const { roster, scorerId, route, rng } = params;

  // Routes that never have a direct assist
  if (
    route === 'direct_fk' ||
    route === 'penalty_kick' ||
    route === 'rebound_poach'
  ) {
    return null;
  }

  // Solo dribble show is usually an unassisted solo run (68% unassisted, 32% pre-dribble lay-off)
  const noAssistProb =
    route === 'solo_dribble'
      ? 0.68
      : route === 'long_range_cannon'
        ? 0.32
        : route === 'cut_inside_curler'
          ? 0.24
          : route === 'gegenpress_steal'
            ? 0.18
            : route === 'corner_header'
              ? 0.06
              : 0.08;

  if (rng() < noAssistProb) return null;

  const candidates = roster.filter(
    (p) => p.id !== scorerId && p.position !== 'GK',
  );
  if (candidates.length === 0) return null;

  const weighted = candidates.map((p) => {
    const attrs = getPlayerAttributes(p);
    const sub = getPrimarySubPosition(p);
    const roleMult = getCreatorRoleMultiplier(sub, route);

    let skillScore = 1.0;
    switch (route) {
      case 'early_cross':
        skillScore =
          Math.pow(Math.max(45, attrs.cro) / 80, 2.55) *
          Math.pow(Math.max(45, attrs.pas) / 80, 1.1);
        if (p.playstyles.some((s) => ['classic_winger', 'attacking_wingback', 'inverted_winger'].includes(s))) {
          skillScore *= 1.38;
        }
        break;
      case 'cutback':
        skillScore =
          Math.pow(Math.max(45, attrs.dri) / 80, 1.65) *
          Math.pow(Math.max(45, attrs.cro) / 80, 1.55) *
          Math.pow(Math.max(45, attrs.pas) / 80, 1.25);
        if (p.playstyles.some((s) => ['inverted_winger', 'classic_winger', 'playmaker_10', 'attacking_wingback'].includes(s))) {
          skillScore *= 1.35;
        }
        break;
      case 'through_ball':
      case 'tiki_taka_triangle':
        skillScore =
          Math.pow(Math.max(45, attrs.pas) / 80, 2.65) *
          Math.pow(Math.max(45, attrs.dri) / 80, 1.15);
        if (p.playstyles.some((s) => ['playmaker_10', 'deep_playmaker', 'inverted_winger'].includes(s))) {
          skillScore *= 1.4;
        }
        break;
      case 'u_buildup_switch':
        skillScore =
          Math.pow(Math.max(45, attrs.pas) / 80, 2.2) *
          Math.pow(Math.max(45, attrs.cro) / 80, 1.45);
        if (p.playstyles.some((s) => ['deep_playmaker', 'ball_playing_cb', 'playmaker_10', 'attacking_wingback'].includes(s))) {
          skillScore *= 1.42;
        }
        break;
      case 'corner_header': {
        const setPieceSkill = attrs.cro * 0.65 + attrs.pas * 0.35;
        skillScore = Math.pow(Math.max(45, setPieceSkill) / 82, 3.0);
        if (p.playstyles.some((s) => ['playmaker_10', 'classic_winger', 'deep_playmaker', 'attacking_wingback'].includes(s))) {
          skillScore *= 1.35;
        }
        break;
      }
      case 'gegenpress_steal':
      case 'low_block_counter':
      default:
        skillScore =
          Math.pow(Math.max(45, attrs.pas) / 80, 2.05) *
          Math.pow(Math.max(45, attrs.dri) / 80, 1.15);
        if (p.playstyles.some((s) => ['playmaker_10', 'box_to_box', 'inverted_winger', 'classic_winger'].includes(s))) {
          skillScore *= 1.3;
        }
        break;
    }

    return {
      item: p,
      weight: Math.max(0.01, roleMult * skillScore),
    };
  });

  return pickWeightedItem(weighted, rng);
}

export function pickFinishType(params: {
  route: AttackRouteId;
  scorer: Player;
  rng: () => number;
}): FinishTypeId {
  const { route, scorer, rng } = params;
  const attrs = getPlayerAttributes(scorer);

  switch (route) {
    case 'early_cross':
      if (attrs.aer >= 84) {
        return rng() < 0.76 ? 'header' : 'volley';
      }
      return rng() < 0.45 ? 'header' : rng() < 0.6 ? 'volley' : 'one_touch';
    case 'corner_header':
      return rng() < 0.84 ? 'header' : 'volley';
    case 'cutback':
      return rng() < 0.58 ? 'one_touch' : 'inside_shot';
    case 'through_ball':
    case 'low_block_counter':
      return rng() < 0.38 ? 'chip_1v1' : rng() < 0.6 ? 'inside_shot' : 'power_drive';
    case 'gegenpress_steal':
      return rng() < 0.52 ? 'power_drive' : 'inside_shot';
    case 'solo_dribble':
      return 'solo_finish';
    case 'cut_inside_curler':
      return 'curler';
    case 'long_range_cannon':
      return 'long_cannon';
    case 'tiki_taka_triangle':
      return rng() < 0.6 ? 'one_touch' : 'inside_shot';
    case 'u_buildup_switch':
      return rng() < 0.5 ? 'volley' : 'power_drive';
    case 'direct_fk':
      return 'free_kick';
    case 'penalty_kick':
      return 'penalty';
    case 'rebound_poach':
    default:
      return 'one_touch';
  }
}

export function pickContestDefender(
  defendingRoster: Player[] | undefined,
  rng: () => number,
): Player | undefined {
  if (!defendingRoster || defendingRoster.length === 0) return undefined;
  const defs = defendingRoster.filter(
    (p) => p.position === 'DF' || p.position === 'MF',
  );
  const pool = defs.length > 0 ? defs : defendingRoster;
  return pool[Math.floor(rng() * pool.length)];
}

export function formatAttackChainDescription(params: {
  pattern: HighlightPatternId;
  attackRoute?: AttackRouteId;
  finishType?: FinishTypeId;
  outcome: HighlightOutcomeType;
  scorerName: string;
  assistName?: string;
  gkName?: string;
  secondaryShooterName?: string;
  contestDefenderName?: string;
  dribbleBeatCount?: number;
  reboundOrigin?: 'save' | 'woodwork' | 'blocked';
  pkDirection?: 'left' | 'center' | 'right';
  shotAngle?: ShotAngleType;
  isJoker?: boolean;
}): string {
  const {
    pattern,
    attackRoute,
    finishType,
    outcome,
    scorerName,
    assistName,
    gkName,
    secondaryShooterName,
    contestDefenderName,
    dribbleBeatCount = 2,
    reboundOrigin = 'save',
    pkDirection = 'right',
    shotAngle,
    isJoker = false,
  } = params;

  const jokerPrefix = isJoker ? '🔥 교체 투입 조커! ' : '';
  const assistTag = assistName ? ` (도움: ${assistName})` : '';
  const gkLabel = gkName ? `${gkName} 골키퍼` : '상대 골키퍼';
  const defLabel = contestDefenderName ? `${contestDefenderName}` : '상대 수비수';

  const pkDirKr =
    pkDirection === 'left'
      ? '좌측 하단'
      : pkDirection === 'right'
        ? '우측 구석'
        : '정면 파넨카';
  const reboundSourceKr =
    reboundOrigin === 'woodwork'
      ? '골대를 맞고 튕겨 나온 볼을'
      : reboundOrigin === 'blocked'
        ? '수비수 몸에 맞고 흐른 세컨드볼을'
        : '골키퍼 선방 후 튕겨 나온 리바운드 볼을';
  const angleNote =
    shotAngle === 'acute_left' || shotAngle === 'acute_right'
      ? '예리한 측면 예각 슈팅으로'
      : shotAngle === 'far_post'
        ? '반대편 파포스트로 감아 차며'
        : shotAngle === 'near_post'
          ? '니어포스트 빈틈을 찌르며'
          : '강력한 슈팅으로';

  if (outcome === 'var_offside') {
    return `📺 VAR 판독! ${scorerName}이(가) 골망을 흔들었으나 부심의 기가 올라갔습니다 — 오프사이드로 득점 취소!`;
  }

  // GOAL descriptions enriched with attackRoute & finishType
  if (outcome === 'goal') {
    if (attackRoute === 'solo_dribble') {
      return `${jokerPrefix}🔥 원맨 드리블 쇼! ${scorerName}이(가) 폭발적인 드리블로 수비 ${dribbleBeatCount}명을 연달아 벗겨낸 뒤 ${angleNote} 원맨골을 터뜨립니다!${assistTag}`;
    }
    if (attackRoute === 'long_range_cannon') {
      return `${jokerPrefix}🚀 중거리 원더골! 페널티 아크 정면에서 ${scorerName}이(가) 때린 대포알 중거리 슛이 골문 상단 구석에 그대로 꽂힙니다!${assistTag}`;
    }
    if (attackRoute === 'tiki_taka_triangle') {
      return `${jokerPrefix}골! 정교한 티키타카 삼각형 원투패스로 수비 블록을 허문 뒤, ${assistName ? `${assistName}의 패스를 받은 ` : ''}${scorerName}이(가) 논스톱 슈팅으로 마무리합니다!${assistTag}`;
    }
    if (attackRoute === 'low_block_counter') {
      return `${jokerPrefix}⚡ 전광석화 역습! 견고한 수비 블록에서 공을 끊어낸 직후 뒷공간 롱패스, 폭발적으로 질주한 ${scorerName}이(가) ${angleNote} 골망을 가릅니다!${assistTag}`;
    }
    if (attackRoute === 'gegenpress_steal') {
      return `${jokerPrefix}골! 강한 게겐프레싱 압박 트랩으로 상대 빌드업을 끊어낸 직후 속공, ${scorerName}이(가) ${angleNote} 마무리합니다!${assistTag}`;
    }

    switch (pattern) {
      case 'wing_cross_header':
        if (finishType === 'volley') {
          return `${jokerPrefix}골! ${assistName ? `${assistName}의 날카로운 얼리 크로스를 ` : '측면 크로스를 '}${scorerName}이(가) 환상적인 논스톱 발리슛으로 연결해 골망을 흔듭니다!${assistTag}`;
        }
        return `${jokerPrefix}골! ${assistName ? `${assistName}의 예리한 크로스! ` : '측면 크로스를 '}${scorerName}이(가) ${defLabel}와의 공중볼 경합을 이겨내고 타점 높은 헤더로 꽂아 넣습니다!${assistTag}`;
      case 'cutback_finish':
        return `${jokerPrefix}골! 하프스페이스 엔드라인을 파고든 ${assistName ? `${assistName}의 정교한 컷백, ` : '컷백을 '}쇄도하던 ${scorerName}이(가) ${angleNote} 마무리!${assistTag}`;
      case 'through_ball_1v1':
        if (finishType === 'chip_1v1') {
          return `${jokerPrefix}골! ${assistName ? `${assistName}의 송곳 같은 스루패스! ` : '수비 뒷공간을 허문 스루패스, '}${scorerName}이(가) 각을 좁혀 나오는 키퍼 키를 넘기는 감각적인 칩슛으로 마무리합니다!${assistTag}`;
        }
        return `${jokerPrefix}골! ${assistName ? `${assistName}의 대지를 가르는 킬패스, ` : '수비 뒷공간을 허문 스루패스, '}${scorerName}이(가) 1대1 찬스를 침착하게 성공시킵니다!${assistTag}`;
      case 'cut_inside_curler':
        return `${jokerPrefix}골! 측면에서 안쪽으로 치고 들어온 ${scorerName}의 환상적인 파포스트 궤적 감아차기 골!${assistTag}`;
      case 'corner_kick':
        return `${jokerPrefix}골! ${assistName ? `${assistName}이(가) 올린 코너킥을 ` : '코너킥 문전 혼전 상황에서 '}${scorerName}이(가) 압도적인 제공권 헤더로 골망을 흔듭니다!${assistTag}`;
      case 'direct_free_kick':
        return `${jokerPrefix}골! ${scorerName}의 그림 같은 직접 프리킥! 수비벽을 넘어 상단 사각지대에 정확히 꽂힙니다!`;
      case 'high_press_counter':
        return `${jokerPrefix}골! 전방 압박으로 볼을 탈취한 직후 고속 역습, ${scorerName}이(가) ${angleNote} 마무리합니다!${assistTag}`;
      case 'u_buildup_switch':
        return `${jokerPrefix}골! 후방 U자 빌드업 후 반대편 측면으로 찔러준 대각선 전환 패스! ${scorerName}이(가) ${angleNote} 골망을 가릅니다!${assistTag}`;
      case 'rebound_finish':
        return `${jokerPrefix}골! ${secondaryShooterName ? `${secondaryShooterName}의 슈팅이 ` : ''}${reboundSourceKr} ${scorerName}이(가) 번개처럼 쇄도해 밀어 넣습니다!`;
      case 'penalty_kick':
        return `${jokerPrefix}🎯 PK 골! 박스 안 돌파 과정에서 얻어낸 페널티킥을 ${scorerName}이(가) ${pkDirKr} 코스로 침착하게 꽂아 넣습니다!`;
    }
  }

  if (outcome === 'save') {
    if (attackRoute === 'solo_dribble') {
      return `수비 ${dribbleBeatCount}명을 제치고 들어간 ${scorerName}의 원맨 돌파 슈팅! ${gkLabel}가 끝까지 각도를 좁혀 슈퍼 세이브로 막아냅니다!`;
    }
    if (attackRoute === 'long_range_cannon') {
      return `${scorerName}의 위협적인 중거리 대포알 슈팅을 ${gkLabel}가 몸을 날려 손끝으로 쳐냅니다!`;
    }
    switch (pattern) {
      case 'wing_cross_header':
        return `측면 크로스에 이은 ${scorerName}의 결정적 헤더를 ${gkLabel}가 몸을 날려 쳐냅니다!`;
      case 'cutback_finish':
        return `날카로운 컷백 후 ${scorerName}의 논스톱 슈팅! ${gkLabel}의 동물적인 반사신경 슈퍼 세이브!`;
      case 'through_ball_1v1':
        return `1대1 결정적 기회! ${scorerName}의 슈팅을 ${gkLabel}가 각도를 좁히며 막아냅니다!`;
      case 'cut_inside_curler':
        return `${scorerName}의 위협적인 감아차기 중거리 슛을 ${gkLabel}가 손끝으로 쳐냅니다!`;
      case 'corner_kick':
        return `코너킥에서 이어진 ${scorerName}의 근거리 헤더를 ${gkLabel}가 극적으로 펀칭해냅니다!`;
      case 'direct_free_kick':
        return `${scorerName}의 수비벽을 넘긴 프리킥! ${gkLabel}가 몸을 던져 막아냅니다!`;
      case 'high_press_counter':
        return `전방 압박 탈취 후 고속 역습 슈팅! ${gkLabel}의 결정적 선방으로 실점을 막습니다!`;
      case 'u_buildup_switch':
        return `반대전환 롱패스 후 ${scorerName}의 측면 예각 슈팅! ${gkLabel}가 니어포스트를 틀어막습니다!`;
      case 'rebound_finish':
        return `${reboundSourceKr} 노린 ${scorerName}의 2차 슈팅까지 ${gkLabel}가 연속 슈퍼세이브로 막아냅니다!`;
      case 'penalty_kick':
        return `🧤 PK 선방!! ${scorerName}의 ${pkDirKr} 페널티킥을 ${gkLabel}가 방향을 완벽히 읽고 몸을 날려 막아냅니다!`;
    }
  }

  if (outcome === 'woodwork') {
    if (attackRoute === 'solo_dribble') {
      return `💥 아깝습니다! 수비진을 단독 드리블로 허문 ${scorerName}의 피니시가 골포스트를 강타하고 튕겨 나옵니다!`;
    }
    if (attackRoute === 'long_range_cannon') {
      return `💥 ${scorerName}의 대포알 중거리 슛이 크로스바를 강타하며 경기장이 술렁입니다!`;
    }
    switch (pattern) {
      case 'direct_free_kick':
        return `💥 ${scorerName}의 직접 프리킥이 크로스바를 강타하고 튕겨 나옵니다!`;
      case 'cut_inside_curler':
        return `💥 ${scorerName}의 감아차기 슈팅이 파포스트를 때리고 나갑니다!`;
      case 'corner_kick':
        return `💥 코너킥에서 ${scorerName}의 헤더가 골대를 맞고 튕겨 나옵니다!`;
      case 'u_buildup_switch':
        return `💥 반대전환 롱패스를 이어받은 ${scorerName}의 예각 슈팅이 골포스트를 강타합니다!`;
      case 'penalty_kick':
        return `💥 PK 실축! ${scorerName}의 페널티킥이 골대를 강타하고 튕겨 나옵니다!`;
      default:
        return `💥 ${scorerName}의 결정적 슈팅이 골대를 강타합니다! 아쉽게 득점 무산!`;
    }
  }

  if (outcome === 'blocked') {
    if (attackRoute === 'solo_dribble') {
      return `🛡️ ${scorerName}이(가) 단독 드리블로 박스 안까지 파고들었으나, ${defLabel}이(가) 완벽한 타이밍의 태클로 슈팅을 저지합니다!`;
    }
    switch (pattern) {
      case 'cutback_finish':
        return `🛡️ 엔드라인 컷백 후 ${scorerName}의 슈팅을 ${defLabel}이(가) 온몸을 던져 육탄 방어합니다!`;
      case 'corner_kick':
        return `🛡️ 코너킥 세컨드볼 슈팅이 밀집한 수비벽(${defLabel})에 맞고 굴절됩니다!`;
      case 'high_press_counter':
        return `🛡️ 고속 역습 상황에서 ${scorerName}의 슈팅을 끝까지 추격한 ${defLabel}이(가) 슬라이딩 태클로 막아냅니다!`;
      case 'u_buildup_switch':
        return `🛡️ 대각선 반대전환 후 ${scorerName}의 슈팅을 ${defLabel}이(가) 결정적 블록으로 막아냅니다!`;
      default:
        return `🛡️ ${scorerName}의 강력한 슈팅을 ${defLabel}이(가) 결정적인 태클로 차단합니다!`;
    }
  }

  // near_miss
  if (attackRoute === 'solo_dribble') {
    return `화려한 개인 드리블로 수비 ${dribbleBeatCount}명을 벗겨낸 ${scorerName}의 슈팅이 골포스트 옆을 간발의 차로 스칩니다!`;
  }
  switch (pattern) {
    case 'wing_cross_header':
      return `측면 크로스에 맞춘 ${scorerName}의 헤더가 골문 위로 살짝 넘어갑니다!`;
    case 'through_ball_1v1':
      return `완벽한 스루패스 1대1 찬스! ${scorerName}의 슈팅이 골포스트 옆을 아슬아슬하게 스칩니다!`;
    case 'direct_free_kick':
      return `${scorerName}의 예리한 프리킥이 골문 구석을 간발의 차로 벗어납니다!`;
    case 'cut_inside_curler':
      return `컷인 후 날린 ${scorerName}의 감아차기가 골대를 살짝 빗나갑니다!`;
    case 'u_buildup_switch':
      return `화려한 반대전환에 이은 ${scorerName}의 파포스트 슈팅이 아쉽게 빗나갑니다!`;
    case 'rebound_finish':
      return `${reboundSourceKr} 노린 ${scorerName}의 2차 슈팅이 크로스바 위로 살짝 뜹니다!`;
    case 'penalty_kick':
      return `😱 PK 실축! ${scorerName}의 페널티킥이 골문 옆으로 빗나갑니다!`;
    default:
      return `${scorerName}의 회심의 슈팅이 골문을 간발의 차로 벗어납니다!`;
  }
}

export function computeTeamSubAttributeModifier(params: {
  attackingRoster: Player[];
  defendingRoster: Player[];
  tactic: TacticId;
  formation?: FormationId;
}): { xgDelta: number; possessionDelta: number } {
  const { attackingRoster, defendingRoster, tactic } = params;
  if (attackingRoster.length === 0 || defendingRoster.length === 0) {
    return { xgDelta: 0, possessionDelta: 0 };
  }

  let atkCount = 0;
  let atkPasSum = 0;
  let sho1 = 0;
  let sho2 = 0;
  let sho3 = 0;
  let cre1 = 0;
  let cre2 = 0;
  let cre3 = 0;
  let maxCro = 0;
  let maxFwAer = 0;

  for (let i = 0; i < attackingRoster.length; i += 1) {
    const p = attackingRoster[i];
    if (p.position === 'GK') continue;
    const a = p.attrs ?? getPlayerAttributes(p);
    atkCount += 1;
    atkPasSum += a.pas;
    if (a.cro > maxCro) maxCro = a.cro;
    if (p.position === 'FW' && a.aer > maxFwAer) maxFwAer = a.aer;

    // Top 3 SHO
    if (a.sho >= sho1) {
      sho3 = sho2;
      sho2 = sho1;
      sho1 = a.sho;
    } else if (a.sho >= sho2) {
      sho3 = sho2;
      sho2 = a.sho;
    } else if (a.sho > sho3) {
      sho3 = a.sho;
    }

    // Top 3 Creator max(pas, cro, dri)
    const cre = a.pas >= a.cro ? (a.pas >= a.dri ? a.pas : a.dri) : (a.cro >= a.dri ? a.cro : a.dri);
    if (cre >= cre1) {
      cre3 = cre2;
      cre2 = cre1;
      cre1 = cre;
    } else if (cre >= cre2) {
      cre3 = cre2;
      cre2 = cre;
    } else if (cre > cre3) {
      cre3 = cre;
    }
  }

  let defCount = 0;
  let defPasSum = 0;
  let d1 = 0;
  let d2 = 0;
  let d3 = 0;
  let d4 = 0;

  for (let i = 0; i < defendingRoster.length; i += 1) {
    const p = defendingRoster[i];
    if (p.position === 'GK') continue;
    const a = p.attrs ?? getPlayerAttributes(p);
    defCount += 1;
    defPasSum += a.pas;
    const res = a.def * 0.7 + a.phy * 0.3;
    if (res >= d1) {
      d4 = d3;
      d3 = d2;
      d2 = d1;
      d1 = res;
    } else if (res >= d2) {
      d4 = d3;
      d3 = d2;
      d2 = res;
    } else if (res >= d3) {
      d4 = d3;
      d3 = res;
    } else if (res > d4) {
      d4 = res;
    }
  }

  if (atkCount === 0 || defCount === 0) {
    return { xgDelta: 0, possessionDelta: 0 };
  }

  const topShoCount = Math.min(3, atkCount);
  const topDefCount = Math.min(4, defCount);
  const avgTopSho = (sho1 + sho2 + sho3) / topShoCount;
  const avgTopCre = (cre1 + cre2 + cre3) / topShoCount;
  const avgTopDef = (d1 + d2 + d3 + d4) / topDefCount;

  const atkThreat = avgTopSho * 0.52 + avgTopCre * 0.48;
  let rawXgDelta = (atkThreat - avgTopDef) * 0.0025;
  if (tactic === 'wingplay' && maxCro >= 88 && maxFwAer >= 85) {
    rawXgDelta += 0.015;
  }

  const xgDelta = Math.max(-0.06, Math.min(0.06, rawXgDelta));
  const possessionDelta = Math.max(
    -2.5,
    Math.min(2.5, (atkPasSum / atkCount - defPasSum / defCount) * 0.18),
  );

  return { xgDelta, possessionDelta };
}

export function resolveHighlightPatternWeightsWithSubAttributes(params: {
  baseWeights: Record<HighlightPatternId, number>;
  roster: Player[];
  tactic: TacticId;
  managerTraitId?: ManagerTraitId | null;
  allowPenalty: boolean;
}): Record<HighlightPatternId, number> {
  const { baseWeights, roster, allowPenalty } = params;
  const weights = { ...baseWeights };
  let maxDri = 0;
  let maxCro = 0;
  let maxPas = 0;
  let fwAer = 72;
  let hasOutfield = false;

  for (let i = 0; i < roster.length; i += 1) {
    const p = roster[i];
    if (p.position === 'GK') continue;
    hasOutfield = true;
    const a = fastAttr(p);
    if (a.dri > maxDri) maxDri = a.dri;
    if (a.cro > maxCro) maxCro = a.cro;
    if (a.pas > maxPas) maxPas = a.pas;
    if (p.position === 'FW' && a.aer > fwAer) fwAer = a.aer;
  }
  if (!hasOutfield) return weights;

  // Boost routes that match the squad's sub-attribute profile
  if (maxCro >= 88 && fwAer >= 84) {
    weights.wing_cross_header *= 1.24;
  }
  if (maxDri >= 92) {
    weights.cut_inside_curler *= 1.25;
    weights.cutback_finish *= 1.18;
    if (allowPenalty) weights.penalty_kick *= 1.15;
  }
  if (maxPas >= 91) {
    weights.through_ball_1v1 *= 1.22;
    weights.u_buildup_switch *= 1.18;
  }

  return weights;
}
