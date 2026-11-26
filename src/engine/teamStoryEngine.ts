import { MANAGER_TRAITS } from '../data/managerTraits';
import type { FormationId, ManagerTraitId, StaffCoachId } from '../types/game';
import type {
  Club,
  Fixture,
  LeagueId,
  MatchResult,
  PlayerSeasonStats,
  StandingRow,
  TacticId,
} from '../types/league';
import type {
  GlobalHofRankingEntry,
  HallOfFameEntry,
  TeamSeasonStory,
  TeamStoryHighlight,
} from '../types/legacy';
import { formatPlayerRecordName } from '../types/player';
import type { Player } from '../types/player';
import type { UclTournamentState } from '../types/ucl';
import type { DomesticCupState } from '../types/cup';
import { USER_CLUB_ID } from './matchEngine';
import { STAFF_COACHES } from './staffCoachEngine';
import { TACTICS } from './tacticEngine';

function getTeamDisplayName(
  teamId: string,
  clubsById: Record<string, Club>,
  userClubName: string,
): string {
  if (teamId === USER_CLUB_ID) return userClubName;
  return clubsById[teamId]?.name ?? teamId;
}

export interface CompactTeamIntroInput {
  clubName: string;
  managerName?: string;
  managerTraitId: ManagerTraitId | null;
  managerRating?: number;
  staffCoachId?: StaffCoachId | null;
  formation: FormationId;
  tactic: TacticId;
  baseAvgOvr: number;
  effectiveOvr?: number;
  chemistry: number;
  awakenedCount?: number;
  classicCount?: number;
  ffpTier?: 0 | 1 | 2;
}

/**
 * Generates a crisp, 1~2 line identity summary capturing manager trait/rating,
 * staff coach, tactical style, effective OVR/chemistry, and awakening/classic flavor.
 */
export function generateCompactTeamIntro(input: CompactTeamIntroInput): string {
  const traitName = input.managerTraitId
    ? MANAGER_TRAITS[input.managerTraitId]?.name ?? null
    : null;
  const tacticName = TACTICS[input.tactic]?.name ?? input.tactic;
  const coach = input.staffCoachId ? STAFF_COACHES[input.staffCoachId] : null;
  const mgrTag = traitName
    ? input.managerRating
      ? `${traitName}(${input.managerRating})`
      : traitName
    : input.managerName
      ? `${input.managerName} 감독`
      : '전술 지휘';

  const ovrPart =
    typeof input.effectiveOvr === 'number' && input.effectiveOvr > input.baseAvgOvr + 0.2
      ? `실효 OVR ${input.effectiveOvr.toFixed(1)}`
      : `OVR ${input.baseAvgOvr.toFixed(1)}`;

  const line1 = `${mgrTag}의 ${input.formation} ${tacticName}으로 완성한 팀(${ovrPart} · 케미 ${Math.round(input.chemistry)}).`;

  const accents: string[] = [];
  if (coach) {
    accents.push(`수석 코치 ${coach.name}(${coach.shortBadge})`);
  }
  if ((input.awakenedCount ?? 0) > 0) {
    accents.push(`포텐 각성 ${input.awakenedCount}인`);
  }
  if ((input.classicCount ?? 0) > 0) {
    accents.push(`클래식 ${input.classicCount}인`);
  }
  if (input.ffpTier === 0 && accents.length < 2) {
    accents.push('FFP 준수 균형 편성');
  }

  if (accents.length === 0) {
    return line1;
  }
  return `${line1} ${accents.slice(0, 3).join(' · ')} 조합으로 시즌 색깔을 각인시켰다.`;
}

function formatGoalScorerList(match: MatchResult, teamId: string): string[] {
  const events = [
    ...match.events,
    ...(match.extraTime?.etEvents ?? []),
  ].filter((ev) => ev.type === 'goal' && ev.teamId === teamId && ev.scorerName);
  return events.map((ev) => `${ev.scorerName} ${ev.minute}'`);
}

function findTitleClinchingMatch(params: {
  fixtures: Fixture[];
  standings: StandingRow[];
  userClubId: string;
  totalRounds: number;
  clubsById: Record<string, Club>;
}): { round: number; match: MatchResult; opponentName: string; userGoals: number; oppGoals: number; isFinalDay: boolean } | null {
  const { fixtures, standings, userClubId, totalRounds, clubsById } = params;
  const userRank = standings.findIndex((r) => r.teamId === userClubId) + 1;
  if (userRank !== 1 || fixtures.length === 0) return null;

  const byRound = new Map<number, Fixture[]>();
  for (const f of fixtures) {
    if (!f.played || !f.result) continue;
    const list = byRound.get(f.round) ?? [];
    list.push(f);
    byRound.set(f.round, list);
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  const pts = new Map<string, number>();

  for (const r of rounds) {
    const rFixtures = byRound.get(r) ?? [];
    let userMatch: MatchResult | null = null;
    for (const f of rFixtures) {
      const res = f.result!;
      const hp = res.homeGoals > res.awayGoals ? 3 : res.homeGoals === res.awayGoals ? 1 : 0;
      const ap = res.awayGoals > res.homeGoals ? 3 : res.homeGoals === res.awayGoals ? 1 : 0;
      pts.set(f.homeTeamId, (pts.get(f.homeTeamId) ?? 0) + hp);
      pts.set(f.awayTeamId, (pts.get(f.awayTeamId) ?? 0) + ap);
      if (f.homeTeamId === userClubId || f.awayTeamId === userClubId) {
        userMatch = res;
      }
    }
    const userPts = pts.get(userClubId) ?? 0;
    let bestOther = 0;
    for (const [tid, p] of pts.entries()) {
      if (tid !== userClubId && p > bestOther) bestOther = p;
    }
    const remaining = Math.max(0, totalRounds - r);
    const clinchedEarly = userPts > bestOther + remaining * 3;
    const isFinalDay = r === totalRounds;
    if ((clinchedEarly || isFinalDay) && userMatch) {
      const isHome = userMatch.homeTeamId === userClubId;
      const oppId = isHome ? userMatch.awayTeamId : userMatch.homeTeamId;
      return {
        round: r,
        match: userMatch,
        opponentName: clubsById[oppId]?.name ?? '상대 구단',
        userGoals: isHome ? userMatch.homeGoals : userMatch.awayGoals,
        oppGoals: isHome ? userMatch.awayGoals : userMatch.homeGoals,
        isFinalDay,
      };
    }
  }
  return null;
}

export interface SoloSeasonStoryInput {
  userClubName: string;
  managerName: string;
  managerTraitId: ManagerTraitId | null;
  managerRating: number;
  staffCoachId?: StaffCoachId | null;
  formation: FormationId;
  tactic: TacticId;
  leagueName: string;
  clubs: Club[];
  standings: StandingRow[];
  fixtures: Fixture[];
  totalRounds: number;
  userMatchHistory: MatchResult[];
  userCupMatchHistory: MatchResult[];
  userUclMatchHistory: MatchResult[];
  cup: DomesticCupState | null;
  ucl: UclTournamentState | null;
  starters: (Player | null)[];
  bench: (Player | null)[];
  combinedStatsMap: Record<string, PlayerSeasonStats>;
  baseAvgOvr: number;
  effectiveOvr: number;
  chemistry: number;
  ffpTier?: 0 | 1 | 2;
  userClubId?: string;
}

/**
 * Generates both the compact 1~2 line team intro and 4~6 authentic match-backed
 * story highlights for Solo Season Summary, HOF archive, and Daily Rankings.
 */
export function generateSoloSeasonTeamStory(
  input: SoloSeasonStoryInput,
): TeamSeasonStory {
  const userClubId = input.userClubId ?? USER_CLUB_ID;
  const squad = [...input.starters, ...input.bench].filter(Boolean) as Player[];
  const awakenedPlayers = squad.filter((p) => Boolean(p.awakening));
  const classicPlayers = squad.filter((p) => p.isLegend);

  const intro = generateCompactTeamIntro({
    clubName: input.userClubName,
    managerName: input.managerName,
    managerTraitId: input.managerTraitId,
    managerRating: input.managerRating,
    staffCoachId: input.staffCoachId,
    formation: input.formation,
    tactic: input.tactic,
    baseAvgOvr: input.baseAvgOvr,
    effectiveOvr: input.effectiveOvr,
    chemistry: input.chemistry,
    awakenedCount: awakenedPlayers.length,
    classicCount: classicPlayers.length,
    ffpTier: input.ffpTier,
  });

  const clubsById: Record<string, Club> = {};
  for (const c of input.clubs) clubsById[c.id] = c;
  if (input.ucl) {
    for (const c of input.ucl.clubs) {
      if (!clubsById[c.id]) clubsById[c.id] = c;
    }
  }

  const highlights: TeamStoryHighlight[] = [];

  // 1) OVR vs League Finish (Overachievement / Dominance)
  const finalRank =
    input.standings.findIndex((r) => r.teamId === userClubId) + 1;
  const userRow = input.standings.find((r) => r.teamId === userClubId);
  if (finalRank > 0 && userRow && input.clubs.length > 0) {
    const aiOvrs = input.clubs
      .filter((c) => c.id !== userClubId)
      .map((c) => (c.att + c.mid + c.def) / 3);
    const higherCount = aiOvrs.filter((v) => v > input.baseAvgOvr + 0.1).length;
    const expectedRank = higherCount + 1;
    const rankDelta = expectedRank - finalRank;
    if (rankDelta >= 3) {
      highlights.push({
        kind: 'overachieve',
        tag: '전력 대비 초과 성과',
        title: `예상 ${expectedRank}위 전력으로 ${input.leagueName} ${finalRank}위 돌파`,
        detail: `기본 OVR ${input.baseAvgOvr.toFixed(1)}의 언더독 스쿼드로 실효 OVR ${input.effectiveOvr.toFixed(1)}까지 끌어올려 ${userRow.points}점을 수확했다.`,
        metric: `+${rankDelta}계단`,
      });
    } else if (finalRank === 1) {
      const runnerUp = input.standings[1];
      const gap = runnerUp ? userRow.points - runnerUp.points : 0;
      highlights.push({
        kind: 'overachieve',
        tag: userRow.lost === 0 ? '무패 우승' : '리그 제패',
        title: `${input.leagueName} 정상 등극 (${userRow.points}점 · ${userRow.won}승 ${userRow.drawn}무 ${userRow.lost}패)`,
        detail:
          userRow.lost === 0
            ? `시즌 내내 단 1패도 허용하지 않으며 완벽한 우승을 완성했다.`
            : runnerUp
              ? `2위 ${runnerUp.teamName}을 승점 ${gap}점 차로 따돌리며 우승 트로피를 들어 올렸다.`
              : `꾸준한 경기력으로 리그 1위를 지켜냈다.`,
        metric: `득실 ${userRow.goalDifference >= 0 ? '+' : ''}${userRow.goalDifference}`,
      });
    }
  }

  // 2) League Title-Clinching Match
  const clinch = findTitleClinchingMatch({
    fixtures: input.fixtures,
    standings: input.standings,
    userClubId,
    totalRounds: input.totalRounds,
    clubsById,
  });
  if (clinch) {
    const scorers = formatGoalScorerList(clinch.match, userClubId).slice(0, 3);
    highlights.push({
      kind: 'title_match',
      tag: clinch.isFinalDay ? '최종전 우승 확정' : `${clinch.round}R 조기 우승`,
      title: `${clinch.round}R ${clinch.opponentName}전 ${clinch.userGoals}-${clinch.oppGoals}으로 우승 마침표`,
      detail:
        scorers.length > 0
          ? `${clinch.isFinalDay ? '최종 라운드까지 이어진 경쟁 끝에 ' : `${input.totalRounds - clinch.round}경기를 남기고 `}우승을 확정했다 (${scorers.join(', ')}).`
          : `${clinch.isFinalDay ? '마지막 라운드에서 ' : `${input.totalRounds - clinch.round}경기를 남기고 `}리그 정상에 올랐다.`,
      metric: `${clinch.userGoals}-${clinch.oppGoals}`,
    });
  }

  // 3) UCL Final / Deep UCL Drama (Late winner / ET / PK)
  const uclFinalMatch = input.ucl?.ties.final[0]?.leg1 ?? null;
  if (
    uclFinalMatch &&
    (uclFinalMatch.homeTeamId === userClubId ||
      uclFinalMatch.awayTeamId === userClubId)
  ) {
    const isHome = uclFinalMatch.homeTeamId === userClubId;
    const ug = isHome ? uclFinalMatch.homeGoals : uclFinalMatch.awayGoals;
    const og = isHome ? uclFinalMatch.awayGoals : uclFinalMatch.homeGoals;
    const oppId = isHome ? uclFinalMatch.awayTeamId : uclFinalMatch.homeTeamId;
    const oppName = getTeamDisplayName(oppId, clubsById, input.userClubName);
    const wonUcl = input.ucl?.championTeamId === userClubId;
    const userGoalsEv = [
      ...uclFinalMatch.events,
      ...(uclFinalMatch.extraTime?.etEvents ?? []),
    ].filter((e) => e.type === 'goal' && e.teamId === userClubId);
    const lastGoal = userGoalsEv[userGoalsEv.length - 1];
    const hasPenalties = Boolean(uclFinalMatch.extraTime?.penalties);
    const isLateDrama = Boolean(lastGoal && lastGoal.minute >= 80 && wonUcl);

    highlights.push({
      kind: 'ucl_final',
      tag: wonUcl ? (isLateDrama ? '챔스 결승 극장골' : 'UCL 우승') : 'UCL 결승',
      title: `챔피언스리그 결승 vs ${oppName} (${ug}-${og}${hasPenalties ? ' PK' : ''})`,
      detail: wonUcl
        ? hasPenalties
          ? `연장 혈투 끝 승부차기에서 승리를 거머쥐며 빅이어를 품었다.`
          : isLateDrama && lastGoal?.scorerName
            ? `${lastGoal.minute}분 ${lastGoal.scorerName}의 결정적 득점이 승부를 가르며 유럽 정상에 섰다.`
            : `${formatGoalScorerList(uclFinalMatch, userClubId).slice(0, 3).join(', ') || '완벽한 경기 운영'}으로 빅이어를 들어 올렸다.`
        : `결승 무대까지 오르는 저력을 보였으나 ${oppName}에 아쉽게 우승을 내주었다.`,
      metric: wonUcl ? '우승' : '준우승',
    });
  }

  // 4) Best Comeback or Biggest Win across all competitions
  const allMatches = [
    ...input.userMatchHistory,
    ...input.userCupMatchHistory,
    ...input.userUclMatchHistory,
  ];
  let bestComeback: {
    match: MatchResult;
    deficit: number;
    ug: number;
    og: number;
    htU: number;
    htO: number;
    oppName: string;
  } | null = null;
  let biggestWin: {
    match: MatchResult;
    margin: number;
    ug: number;
    og: number;
    oppName: string;
  } | null = null;

  for (const m of allMatches) {
    const isHome = m.homeTeamId === userClubId;
    const ug = isHome ? m.homeGoals : m.awayGoals;
    const og = isHome ? m.awayGoals : m.homeGoals;
    const htU = isHome ? m.halftimeHomeGoals : m.halftimeAwayGoals;
    const htO = isHome ? m.halftimeAwayGoals : m.halftimeHomeGoals;
    const oppId = isHome ? m.awayTeamId : m.homeTeamId;
    const oppName = getTeamDisplayName(oppId, clubsById, input.userClubName);

    if (
      ug > og &&
      typeof htU === 'number' &&
      typeof htO === 'number' &&
      htO > htU
    ) {
      const deficit = htO - htU;
      const bonus = m.competition === 'ucl' ? 0.5 : m.competition === 'cup' ? 0.3 : 0;
      if (
        !bestComeback ||
        deficit + bonus > bestComeback.deficit + (bestComeback.match.competition === 'ucl' ? 0.5 : 0)
      ) {
        bestComeback = { match: m, deficit, ug, og, htU, htO, oppName };
      }
    }
    if (ug > og) {
      const margin = ug - og;
      if (
        !biggestWin ||
        margin > biggestWin.margin ||
        (margin === biggestWin.margin && ug > biggestWin.ug)
      ) {
        biggestWin = { match: m, margin, ug, og, oppName };
      }
    }
  }

  if (bestComeback) {
    const scorers = formatGoalScorerList(bestComeback.match, userClubId).slice(0, 3);
    const compTag =
      bestComeback.match.competitionLabel ??
      (bestComeback.match.competition === 'ucl'
        ? 'UCL'
        : bestComeback.match.competition === 'cup'
          ? '컵'
          : `${bestComeback.match.round}R`);
    highlights.push({
      kind: 'comeback',
      tag: bestComeback.deficit >= 2 ? '대역전승' : '역전 명승부',
      title: `${compTag} ${bestComeback.oppName}전 ${bestComeback.htU}-${bestComeback.htO} → ${bestComeback.ug}-${bestComeback.og} 뒤집기`,
      detail:
        scorers.length > 0
          ? `전반 열세를 딛고 후반 대반격으로 승부를 뒤집었다 (${scorers.join(', ')}).`
          : `전반 열세를 후반 집중력으로 완벽히 뒤집은 시즌 최고의 반전 경기였다.`,
      metric: `HT ${bestComeback.htU}-${bestComeback.htO}`,
    });
  } else if (biggestWin && biggestWin.margin >= 3) {
    const scorers = formatGoalScorerList(biggestWin.match, userClubId).slice(0, 3);
    highlights.push({
      kind: 'best_match',
      tag: '최고의 대승',
      title: `${biggestWin.oppName}전 ${biggestWin.ug}-${biggestWin.og} 화력 쇼`,
      detail:
        scorers.length > 0
          ? `압도적인 공격 전개로 완승을 거뒀다 (${scorers.join(', ')}).`
          : `시즌 최다 점수 차 승리로 팀의 화력을 증명했다.`,
      metric: `+${biggestWin.margin}골 차`,
    });
  }

  // 5) Potential Awakening Ace Highlight
  if (awakenedPlayers.length > 0) {
    const sortedAwakened = [...awakenedPlayers].sort(
      (a, b) =>
        (b.awakening?.ovrGain ?? 0) - (a.awakening?.ovrGain ?? 0) ||
        b.ovr - a.ovr,
    );
    const hero = sortedAwakened[0];
    const heroAfterOvr = hero.awakening!.originalOvr + hero.awakening!.ovrGain;
    const st = input.combinedStatsMap[hero.id];
    const statText = st
      ? `${st.goals}골 ${st.assists}도움 · 평점 ${st.avgRating.toFixed(2)}`
      : `OVR ${hero.awakening!.originalOvr}→${heroAfterOvr}`;
    highlights.push({
      kind: 'awakening',
      tag: '포텐 각성 에이스',
      title:
        sortedAwakened.length === 1
          ? `${formatPlayerRecordName(hero)} 포텐 폭발 (${hero.awakening!.originalOvr}→${heroAfterOvr})`
          : `${formatPlayerRecordName(hero)} 외 ${sortedAwakened.length - 1}명 포텐 각성`,
      detail: `시즌 중 결정적 성장(+${hero.awakening!.ovrGain})을 이뤄내며 ${statText}의 핵심 활약을 펼쳤다.`,
      metric: `OVR +${hero.awakening!.ovrGain}`,
    });
  } else {
    // Fallback: Season Ace
    const userStats = Object.values(input.combinedStatsMap).filter(
      (s) => s.teamId === userClubId && s.appearances >= 5,
    );
    const ace = [...userStats].sort(
      (a, b) => b.goals + b.assists - (a.goals + a.assists) || b.avgRating - a.avgRating,
    )[0];
    if (ace) {
      highlights.push({
        kind: 'ace',
        tag: '시즌 에이스',
        title: `${ace.playerName} 팀 공격 주도`,
        detail: `공식전 ${ace.appearances}경기 ${ace.goals}골 ${ace.assists}도움(평균 평점 ${ace.avgRating.toFixed(2)})으로 공격을 이끌었다.`,
        metric: `${ace.goals}G ${ace.assists}A`,
      });
    }
  }

  // 6) Longest Win / Unbeaten Streak (League)
  if (input.userMatchHistory.length > 0 && highlights.length < 6) {
    let curWin = 0;
    let maxWin = 0;
    let curUnb = 0;
    let maxUnb = 0;
    for (const m of input.userMatchHistory) {
      const isHome = m.homeTeamId === userClubId;
      const ug = isHome ? m.homeGoals : m.awayGoals;
      const og = isHome ? m.awayGoals : m.homeGoals;
      if (ug > og) {
        curWin += 1;
        curUnb += 1;
      } else if (ug === og) {
        curWin = 0;
        curUnb += 1;
      } else {
        curWin = 0;
        curUnb = 0;
      }
      if (curWin > maxWin) maxWin = curWin;
      if (curUnb > maxUnb) maxUnb = curUnb;
    }
    if (maxWin >= 5 || maxUnb >= 10) {
      highlights.push({
        kind: 'streak',
        tag: '상승세 행진',
        title:
          maxWin >= 5
            ? `리그 ${maxWin}연승 · 최장 ${maxUnb}경기 무패`
            : `리그 최장 ${maxUnb}경기 연속 무패`,
        detail: `흔들림 없는 경기 운영으로 순위 경쟁의 분수령을 완전히 장악했다.`,
        metric: maxWin >= 5 ? `${maxWin}연승` : `${maxUnb}무패`,
      });
    }
  }

  return {
    intro,
    highlights: highlights.slice(0, 6),
  };
}

/**
 * Deterministically builds a TeamSeasonStory fallback for archived HallOfFameEntry
 * records created before `teamStory` was serialized.
 */
export function resolveHofTeamStory(entry: HallOfFameEntry): TeamSeasonStory {
  if (entry.teamStory && entry.teamStory.intro) {
    return entry.teamStory;
  }

  const allSquad = [...entry.starters, ...entry.bench];
  const awakened = allSquad.filter((p) => Boolean(p.awakening));
  const classics = allSquad.filter((p) => p.isLegend);

  const intro = generateCompactTeamIntro({
    clubName: entry.userClub.name,
    managerName: entry.managerName,
    managerTraitId: entry.managerTraitId,
    managerRating: entry.managerRating,
    staffCoachId: entry.staffCoachId,
    formation: entry.formation,
    tactic: entry.defaultTactic,
    baseAvgOvr: entry.teamAvgOvr,
    effectiveOvr:
      entry.avgSynergyOvrBonus !== undefined
        ? Math.round((entry.teamAvgOvr + entry.avgSynergyOvrBonus) * 10) / 10
        : undefined,
    chemistry: entry.chemistry,
    awakenedCount: awakened.length,
    classicCount: classics.length,
    ffpTier: entry.seasonScore.ffpTier,
  });

  const highlights: TeamStoryHighlight[] = [];
  if (entry.isTreble) {
    highlights.push({
      kind: 'overachieve',
      tag: '역사적 트레블',
      title: `${entry.leagueKoreanName} · ${entry.cupName} · UCL 3관왕 달성`,
      detail: `${entry.leagueRecord}(${entry.leaguePoints}점)과 유럽 정상 등극으로 구단 역사에 남을 시즌을 썼다.`,
      metric: `${entry.seasonScore.totalScore.toLocaleString()} PTS`,
    });
  } else if (entry.isLeagueChampion) {
    highlights.push({
      kind: 'title_match',
      tag: '리그 우승',
      title: `${entry.leagueKoreanName} 1위 (${entry.leaguePoints}점 · ${entry.leagueRecord})`,
      detail: `리그 우승과 함께 컵 ${entry.cupResultLabel} · UCL ${entry.uclResultLabel}의 성적을 기록했다.`,
      metric: `${entry.leaguePoints}점`,
    });
  }

  const history = entry.matchHistory ?? [];
  const uclFinal = history.find(
    (m) => m.competition === 'ucl' && m.label.includes('결승'),
  );
  if (uclFinal) {
    highlights.push({
      kind: 'ucl_final',
      tag: entry.uclWon ? 'UCL 우승' : 'UCL 결승',
      title: `챔피언스리그 결승 vs ${uclFinal.opponentName} (${uclFinal.userGoals}-${uclFinal.oppGoals})`,
      detail:
        uclFinal.scorers.length > 0
          ? `주요 득점: ${uclFinal.scorers.slice(0, 3).join(', ')}${uclFinal.note ? ` · ${uclFinal.note}` : ''}`
          : entry.uclWon
            ? '결승 무대를 제압하며 빅이어를 들어 올렸다.'
            : '결승까지 오르는 저력을 발휘했다.',
      metric: entry.uclWon ? '우승' : '준우승',
    });
  }

  const bigWin = [...history]
    .filter((m) => m.outcome === 'W')
    .sort((a, b) => b.userGoals - b.oppGoals - (a.userGoals - a.oppGoals) || b.userGoals - a.userGoals)[0];
  if (bigWin && bigWin.userGoals - bigWin.oppGoals >= 3) {
    highlights.push({
      kind: 'best_match',
      tag: '최고의 경기',
      title: `${bigWin.label} ${bigWin.opponentName}전 ${bigWin.userGoals}-${bigWin.oppGoals} 완승`,
      detail:
        bigWin.scorers.length > 0
          ? `득점자: ${bigWin.scorers.slice(0, 3).join(', ')}`
          : '압도적인 경기력으로 승리를 챙겼다.',
      metric: `+${bigWin.userGoals - bigWin.oppGoals}골 차`,
    });
  }

  if (awakened.length > 0) {
    const topAwakened = [...awakened].sort(
      (a, b) => (b.awakening?.ovrGain ?? 0) - (a.awakening?.ovrGain ?? 0),
    )[0];
    const afterOvr =
      topAwakened.awakening!.originalOvr + topAwakened.awakening!.ovrGain;
    highlights.push({
      kind: 'awakening',
      tag: '포텐 각성',
      title: `${topAwakened.name} 각성 (${topAwakened.awakening!.originalOvr}→${afterOvr})`,
      detail: `${topAwakened.goals}골 ${topAwakened.assists}도움 · 평점 ${topAwakened.avgRating.toFixed(2)}로 팀의 도약을 이끌었다.`,
      metric: `OVR +${topAwakened.awakening!.ovrGain}`,
    });
  } else if (entry.topScorerSummary && entry.topScorerSummary !== '-') {
    highlights.push({
      kind: 'ace',
      tag: '핵심 득점원',
      title: entry.topScorerSummary,
      detail: `시즌 공격의 중심축으로 팀의 득점을 책임졌다.`,
    });
  }

  return { intro, highlights: highlights.slice(0, 5) };
}

/**
 * Resolves TeamSeasonStory for a Global/Daily Ranking entry (uses serialized story if present,
 * or synthesizes cleanly from snapshot + breakdown fields).
 */
export function resolveGlobalEntryTeamStory(
  entry: GlobalHofRankingEntry,
): TeamSeasonStory {
  const existing = entry.teamStory ?? entry.squadSnapshot?.teamStory;
  if (existing && existing.intro) {
    return existing;
  }

  const allSquad = [
    ...(entry.squadSnapshot?.starters ?? []),
    ...(entry.squadSnapshot?.bench ?? []),
  ];
  const awakened = allSquad.filter((p) => Boolean(p.awakening));
  const classics = allSquad.filter((p) => p.isLegend);

  const intro = generateCompactTeamIntro({
    clubName: entry.clubName,
    managerName: entry.managerName,
    managerTraitId: entry.managerTraitId,
    managerRating: entry.managerRating,
    staffCoachId: entry.staffCoachId ?? entry.squadSnapshot?.staffCoachId,
    formation: entry.formation,
    tactic: entry.defaultTactic,
    baseAvgOvr: entry.teamAvgOvr,
    effectiveOvr:
      Math.round((entry.teamAvgOvr + entry.avgSynergyOvrBonus) * 10) / 10,
    chemistry: entry.chemistry,
    awakenedCount: awakened.length,
    classicCount: classics.length,
    ffpTier: entry.scoreBreakdown.ffpTier,
  });

  const highlights: TeamStoryHighlight[] = [];
  if (entry.isTreble) {
    highlights.push({
      kind: 'overachieve',
      tag: '트레블 달성',
      title: `${entry.leagueKoreanName} · ${entry.cupName} · UCL 3관왕`,
      detail: `${entry.leagueRecord}(${entry.leaguePoints}점)의 압도적 시즌으로 유럽을 제패했다.`,
      metric: `${entry.seasonScore.toLocaleString()} PTS`,
    });
  } else if (entry.isLeagueChampion) {
    highlights.push({
      kind: 'title_match',
      tag: '리그 우승',
      title: `${entry.leagueKoreanName} 정상 (${entry.leaguePoints}점 · ${entry.leagueRecord})`,
      detail: `자국 컵 ${entry.cupResultLabel} · 챔피언스리그 ${entry.uclResultLabel}의 성과를 올렸다.`,
      metric: `${entry.leaguePoints}점`,
    });
  } else {
    highlights.push({
      kind: 'overachieve',
      tag: '시즌 성적',
      title: `${entry.leagueKoreanName} ${entry.finalLeagueRank}위 (${entry.leaguePoints}점)`,
      detail: `${entry.leagueRecord} · ${entry.cupName} ${entry.cupResultLabel} · UCL ${entry.uclResultLabel}`,
      metric: `${entry.seasonScore.toLocaleString()} PTS`,
    });
  }

  if (entry.uclWon) {
    highlights.push({
      kind: 'ucl_final',
      tag: '유럽 제패',
      title: 'UEFA 챔피언스리그 우승',
      detail: `유럽 최강 클럽들을 연파하며 빅이어를 들어 올렸다.`,
      metric: 'UCL 우승',
    });
  }

  if (awakened.length > 0) {
    const hero = [...awakened].sort(
      (a, b) => (b.awakening?.ovrGain ?? 0) - (a.awakening?.ovrGain ?? 0),
    )[0];
    const heroAfterOvr = hero.awakening!.originalOvr + hero.awakening!.ovrGain;
    highlights.push({
      kind: 'awakening',
      tag: '포텐 각성',
      title: `${hero.name} (${hero.awakening!.originalOvr}→${heroAfterOvr})`,
      detail:
        awakened.length > 1
          ? `총 ${awakened.length}명의 각성 에이스가 스쿼드 잠재력을 폭발시켰다.`
          : `핵심 자원의 포텐 폭발(+${hero.awakening!.ovrGain})이 승부처에서 빛났다.`,
      metric: `OVR +${hero.awakening!.ovrGain}`,
    });
  }

  if (entry.topScorerSummary && entry.topScorerSummary !== '-') {
    highlights.push({
      kind: 'ace',
      tag: '시즌 에이스',
      title: entry.topScorerSummary,
      detail: `감독 궁합 ${entry.managerSynergyCount}명 · 평균 시너지 +${entry.avgSynergyOvrBonus.toFixed(1)} OVR로 공격을 완성했다.`,
    });
  }

  return { intro, highlights: highlights.slice(0, 4) };
}

export interface MpClubStoryInput {
  clubName: string;
  managerName: string;
  managerTraitId: ManagerTraitId | null;
  staffCoachId?: StaffCoachId | null;
  formation: FormationId;
  tactic: TacticId;
  leagueName: string;
  leagueRank?: number;
  standingRow?: StandingRow | null;
  cupResultLabel?: string;
  uclResultLabel?: string;
  starters: (Player | null)[];
  bench: (Player | null)[];
  baseAvgOvr: number;
  effectiveOvr: number;
  chemistry: number;
  ffpTier?: 0 | 1 | 2;
  teamStats: PlayerSeasonStats[];
  h2hSummary?: { wins: number; draws: number; losses: number } | null;
  leagueAvgOvr?: number;
}

/**
 * Generates a concise TeamSeasonStory for Multiplayer League clubs in both
 * regular-season summary and final board.
 */
export function generateMpClubTeamStory(input: MpClubStoryInput): TeamSeasonStory {
  const squad = [...input.starters, ...input.bench].filter(Boolean) as Player[];
  const awakened = squad.filter((p) => Boolean(p.awakening));
  const classics = squad.filter((p) => p.isLegend);

  const intro = generateCompactTeamIntro({
    clubName: input.clubName,
    managerName: input.managerName,
    managerTraitId: input.managerTraitId,
    staffCoachId: input.staffCoachId,
    formation: input.formation,
    tactic: input.tactic,
    baseAvgOvr: input.baseAvgOvr,
    effectiveOvr: input.effectiveOvr,
    chemistry: input.chemistry,
    awakenedCount: awakened.length,
    classicCount: classics.length,
    ffpTier: input.ffpTier,
  });

  const highlights: TeamStoryHighlight[] = [];
  if (input.standingRow && input.leagueRank) {
    const r = input.standingRow;
    highlights.push({
      kind: input.leagueRank === 1 ? 'title_match' : 'overachieve',
      tag: input.leagueRank === 1 ? '리그 우승' : '리그 성적',
      title: `${input.leagueName} ${input.leagueRank}위 (${r.points}점 · ${r.won}승 ${r.drawn}무 ${r.lost}패)`,
      detail: `득실 ${r.goalDifference >= 0 ? '+' : ''}${r.goalDifference}(${r.goalsFor}득 ${r.goalsAgainst}실) · 실효 OVR ${input.effectiveOvr.toFixed(1)}으로 시즌을 완주했다.`,
      metric: `${r.points}점`,
    });
  }

  if (
    input.h2hSummary &&
    input.h2hSummary.wins + input.h2hSummary.draws + input.h2hSummary.losses > 0
  ) {
    const { wins, draws, losses } = input.h2hSummary;
    highlights.push({
      kind: 'best_match',
      tag: '친구 맞대결',
      title: `라이벌 H2H ${wins}승 ${draws}무 ${losses}패`,
      detail:
        wins > losses
          ? `유저 간 맞대결에서 우위를 점하며 리그 주도권을 쥐었다.`
          : `치열한 유저 맞대결 속에서 시즌 순위 싸움을 이어갔다.`,
      metric: `${wins}W ${draws}D ${losses}L`,
    });
  }

  if (input.uclResultLabel && input.uclResultLabel !== '미진출') {
    highlights.push({
      kind: 'ucl_final',
      tag: input.uclResultLabel.includes('우승') ? 'UCL 우승' : '챔피언스리그',
      title: `UEFA 챔피언스리그 ${input.uclResultLabel}`,
      detail: input.cupResultLabel
        ? `자국 컵 ${input.cupResultLabel}과 병행하며 유럽 무대에 도전했다.`
        : `유럽 무대에서 스쿼드 경쟁력을 증명했다.`,
      metric: input.uclResultLabel,
    });
  }

  if (awakened.length > 0) {
    const hero = [...awakened].sort(
      (a, b) => (b.awakening?.ovrGain ?? 0) - (a.awakening?.ovrGain ?? 0),
    )[0];
    const heroAfterOvr = hero.awakening!.originalOvr + hero.awakening!.ovrGain;
    const st = input.teamStats.find((s) => s.playerId === hero.id);
    highlights.push({
      kind: 'awakening',
      tag: '포텐 각성 에이스',
      title: `${formatPlayerRecordName(hero)} (${hero.awakening!.originalOvr}→${heroAfterOvr})`,
      detail: st
        ? `${st.goals}골 ${st.assists}도움 · 평점 ${st.avgRating.toFixed(2)}로 팀의 성장 축이 되었다.`
        : `시즌 중 OVR +${hero.awakening!.ovrGain} 영구 각성을 이뤄냈다.`,
      metric: `OVR +${hero.awakening!.ovrGain}`,
    });
  }

  const topScorer = [...input.teamStats]
    .filter((s) => s.appearances > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0];
  if (topScorer && topScorer.goals > 0) {
    highlights.push({
      kind: 'ace',
      tag: '팀 최다 득점',
      title: `${topScorer.playerName} (${topScorer.goals}골 ${topScorer.assists}도움)`,
      detail: `평균 평점 ${topScorer.avgRating.toFixed(2)}로 팀 최전방을 이끌었다.`,
      metric: `${topScorer.goals}G`,
    });
  }

  return { intro, highlights: highlights.slice(0, 5) };
}

export function normalizeLeagueIdLabel(leagueId: LeagueId): string {
  switch (leagueId) {
    case 'epl':
      return '프리미어리그';
    case 'laliga':
      return '라리가';
    case 'seriea':
      return '세리에 A';
    case 'bundesliga':
      return '분데스리가';
    case 'ligue1':
      return '리그 1';
  }
}
