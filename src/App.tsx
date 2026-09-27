// App shell: one persistent 3D canvas behind every screen (menu uses attract mode), screens on top.
import { useEffect } from 'react';
import { GameCanvas } from './render/GameCanvas';
import { useGame } from './game/store';
import { MainMenu } from './ui/menu/MainMenu';
import { NewRun } from './ui/menu/NewRun';
import { Codex } from './ui/menu/Codex';
import { Settings } from './ui/menu/Settings';
import { Summary } from './ui/menu/Summary';
import { GameScreen } from './ui/hud/GameScreen';
import { audio } from './audio';

export default function App() {
  const screen = useGame((g) => g.screen);
  useEffect(() => {
    const unlock = () => audio.init();
    window.addEventListener('pointerdown', unlock, { once: true });
    if (useGame.getState().screen === 'boot') useGame.getState().setScreen('menu');
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);
  return (
    <>
      <GameCanvas />
      {screen === 'menu' && <MainMenu />}
      {screen === 'newRun' && <NewRun />}
      {screen === 'codex' && <Codex />}
      {screen === 'settings' && <Settings />}
      {screen === 'summary' && <Summary />}
      {screen === 'game' && <GameScreen />}
    </>
  );
}
