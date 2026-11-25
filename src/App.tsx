import { AwakeningCelebrationModal } from './components/common/AwakeningCelebrationModal';
import { HeaderNav } from './components/common/HeaderNav';
import { InjuryAlertModal } from './components/common/InjuryAlertModal';
import { InjuryReturnToast } from './components/common/InjuryReturnToast';
import { ManagerEventModal } from './components/common/ManagerEventModal';
import { StaffCoachHireModal } from './components/common/StaffCoachHireModal';
import { TacticalAdaptationModal } from './components/common/TacticalAdaptationModal';
import { DraftScreen } from './components/draft/DraftScreen';
import { DreamMatchArena } from './components/dream/DreamMatchArena';
import { LeagueSelect } from './components/league/LeagueSelect';
import { SeasonDashboard } from './components/league/SeasonDashboard';
import { SeasonSummary } from './components/league/SeasonSummary';
import { AchievementToast } from './components/legacy/AchievementToast';
import { LegacyHubModal } from './components/legacy/LegacyHubModal';
import { MultiplayerArena } from './components/multiplayer/MultiplayerArena';
import { FormationSelect } from './components/setup/FormationSelect';
import { ManagerRouletteScreen } from './components/setup/ManagerRouletteScreen';
import { TitleScreen } from './components/setup/TitleScreen';
import { UclDashboard } from './components/ucl/UclDashboard';
import { GameProvider, useGame } from './store/GameContext';

function GameRouter() {
  const {
    state,
    activeTactic,
    chemistry,
    ratings,
    dreamMatchOpen,
    multiplayerOpen,
    soloTickerPlaying,
    swapSquadPositions,
    resolveManagerEvent,
    dismissManagerEventResolution,
    dismissInjuryAlerts,
    dismissInjuryReturnToast,
    hireStaffCoach,
    skipStaffCoach,
    dismissAdaptationAlert,
    dismissAwakeningAlert,
  } = useGame();

  const isPlayableSeason =
    !dreamMatchOpen &&
    !multiplayerOpen &&
    !soloTickerPlaying &&
    !state.season?.liveHalftime &&
    (state.phase === 'season' || state.phase === 'ucl');
  const isTransferOpen = Boolean(state.season?.transferMarket.isOpen);
  const hasPendingStaffCoach = Boolean(
    isPlayableSeason &&
      state.season?.staffCoach?.pendingSelection &&
      state.season.staffCoach.offeredCoachIds.length > 0,
  );
  const pendingInjuryAlerts =
    isPlayableSeason && !hasPendingStaffCoach && !isTransferOpen
      ? (state.season?.pendingInjuryAlerts ?? [])
      : [];
  const injuryReturnToasts =
    isPlayableSeason ? (state.season?.injuryReturnToasts ?? []) : [];
  const pendingAwakeningAlert =
    isPlayableSeason &&
    !hasPendingStaffCoach &&
    !isTransferOpen &&
    pendingInjuryAlerts.length === 0
      ? (state.season?.pendingAwakeningAlerts?.[0] ?? null)
      : null;
  const pendingAdaptationAlert =
    isPlayableSeason &&
    !hasPendingStaffCoach &&
    !isTransferOpen &&
    pendingInjuryAlerts.length === 0 &&
    !pendingAwakeningAlert
      ? (state.season?.tacticalAdaptation?.pendingAlert ?? null)
      : null;
  const activeManagerEvent =
    isPlayableSeason &&
    !hasPendingStaffCoach &&
    !isTransferOpen &&
    pendingInjuryAlerts.length === 0 &&
    !pendingAwakeningAlert &&
    !pendingAdaptationAlert
      ? (state.season?.managerEvents?.activeEvent ?? null)
      : null;
  const lastManagerResolution =
    isPlayableSeason &&
    !hasPendingStaffCoach &&
    !isTransferOpen &&
    pendingInjuryAlerts.length === 0 &&
    !pendingAwakeningAlert &&
    !pendingAdaptationAlert
      ? (state.season?.managerEvents?.lastResolution ?? null)
      : null;

  return (
    <div className="min-h-dvh w-full max-w-full overflow-x-clip flex flex-col">
      <HeaderNav />
      <main className="flex-1 w-full max-w-full pb-10">
        {multiplayerOpen ? (
          <MultiplayerArena />
        ) : dreamMatchOpen ? (
          <DreamMatchArena />
        ) : (
          <>
            {state.phase === 'title' && <TitleScreen />}
            {state.phase === 'manager_roulette' && <ManagerRouletteScreen />}
            {state.phase === 'setup' && <FormationSelect />}
            {state.phase === 'draft' && <DraftScreen />}
            {state.phase === 'league_select' && <LeagueSelect />}
            {state.phase === 'season' && <SeasonDashboard />}
            {state.phase === 'ucl' && <UclDashboard />}
            {state.phase === 'season_end' && <SeasonSummary />}
          </>
        )}
      </main>
      <LegacyHubModal />
      <AchievementToast />
      <InjuryReturnToast
        toasts={injuryReturnToasts}
        onDismiss={dismissInjuryReturnToast}
      />
      {hasPendingStaffCoach && state.season?.staffCoach && (
        <StaffCoachHireModal
          offeredCoachIds={state.season.staffCoach.offeredCoachIds}
          activeTactic={activeTactic}
          onHire={hireStaffCoach}
          onSkip={skipStaffCoach}
        />
      )}
      <InjuryAlertModal
        alerts={pendingInjuryAlerts}
        formation={state.formation}
        starters={state.starters}
        bench={state.bench}
        chemistry={chemistry}
        ratings={ratings}
        managerTraitId={state.manager.traitId}
        conditionMap={state.season?.playerConditions}
        onSwapSlots={swapSquadPositions}
        onConfirmClose={dismissInjuryAlerts}
      />
      {pendingAwakeningAlert && (
        <AwakeningCelebrationModal
          alert={pendingAwakeningAlert}
          onDismiss={dismissAwakeningAlert}
        />
      )}
      {pendingAdaptationAlert && (
        <TacticalAdaptationModal
          alert={pendingAdaptationAlert}
          managerAvatar={state.manager.avatar}
          managerName={state.manager.name}
          userClub={state.userClub}
          onDismiss={dismissAdaptationAlert}
          onGoToTactics={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('rtt:go-to-tactics'));
            }
          }}
        />
      )}
      <ManagerEventModal
        activeEvent={activeManagerEvent}
        lastResolution={lastManagerResolution}
        managerAvatar={state.manager.avatar}
        managerName={state.manager.name}
        userClub={state.userClub}
        onSelectChoice={resolveManagerEvent}
        onDismissResolution={dismissManagerEventResolution}
      />
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}
