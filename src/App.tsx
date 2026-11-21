import { HeaderNav } from './components/common/HeaderNav';
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
  const { state } = useGame();

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderNav />
      <main className="flex-1 pb-10">
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
