import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/cinzel-decorative/700.css';
import './ui/theme.css';
import App from './App';

// `?dev=<name>` renders src/dev/<name>.tsx (default export) instead of the app — isolated harnesses for
// building/verifying screens with fixture state before the whole game is wired.
const devModules = import.meta.glob<{ default: ComponentType }>('./dev/*.tsx');
const devName = new URLSearchParams(location.search).get('dev');
const root = createRoot(document.getElementById('root')!);

async function boot() {
  let Root: ComponentType = App;
  const loader = devName ? devModules[`./dev/${devName}.tsx`] : undefined;
  if (loader) Root = (await loader()).default;
  root.render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}
void boot();
