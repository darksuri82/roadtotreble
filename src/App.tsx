import { HeaderNav } from './components/common/HeaderNav';
import { InjuryAlertModal } from './components/common/InjuryAlertModal';
import { ManagerEventModal } from './components/common/ManagerEventModal';
import { DraftScreen } from './components/draft/DraftScreen';
import { LeagueSelect } from './components/league/LeagueSelect';
import { SeasonDashboard } from './components/league/SeasonDashboard';
import { SeasonSummary } from './components/league/SeasonSummary';
import { AchievementToast } from './components/legacy/AchievementToast';
import { LegacyHubModal } from './components/legacy/LegacyHubModal';
import { FormationSelect } from './components/setup/FormationSelect';
import { ManagerRouletteScreen } from './components/setup/ManagerRouletteScreen';
import { TitleScreen } from './components/setup/TitleScreen';
import { UclDashboard } from './components/ucl/UclDashboard';
import { GameProvider, useGame } from './store/GameContext';

function GameRouter() {
  const {
    state,
    resolveManagerEvent,
    dismissManagerEventResolution,
    dismissInjuryAlerts,
    autoReplaceInjuredStarter,
  } = useGame();

  const isPlayableSeason = state.phase === 'season' || state.phase === 'ucl';
  const pendingInjuryAlerts =
    isPlayableSeason ? (state.season?.pendingInjuryAlerts ?? []) : [];
  const activeManagerEvent =
    isPlayableSeason && pendingInjuryAlerts.length === 0
      ? (state.season?.managerEvents?.activeEvent ?? null)
      : null;
  const lastManagerResolution =
    isPlayableSeason && pendingInjuryAlerts.length === 0
      ? (state.season?.managerEvents?.lastResolution ?? null)
      : null;

  return (
    <div className="min-h-dvh w-full max-w-full overflow-x-clip flex flex-col">
      <HeaderNav />
      <main className="flex-1 w-full max-w-full pb-10">
        {state.phase === 'title' && <TitleScreen />}
        {state.phase === 'manager_roulette' && <ManagerRouletteScreen />}
        {state.phase === 'setup' && <FormationSelect />}
        {state.phase === 'draft' && <DraftScreen />}
        {state.phase === 'league_select' && <LeagueSelect />}
        {state.phase === 'season' && <SeasonDashboard />}
        {state.phase === 'ucl' && <UclDashboard />}
        {state.phase === 'season_end' && <SeasonSummary />}
      </main>
      <LegacyHubModal />
      <AchievementToast />
      <InjuryAlertModal
        alerts={pendingInjuryAlerts}
        bench={state.bench}
        conditionMap={state.season?.playerConditions}
        onAutoReplace={autoReplaceInjuredStarter}
        onClose={dismissInjuryAlerts}
      />
      <ManagerEventModal
        activeEvent={activeManagerEvent}
        lastResolution={lastManagerResolution}
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
