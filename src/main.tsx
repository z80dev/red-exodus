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

// `?dev=<name>` renders src/dev/<name>.tsx (default export) instead of the app — isolated harnesses for
// building/verifying screens with fixture state before the whole game is wired.
// App is imported dynamically on purpose: which root loads is runtime-selected, and a dev harness must not
// pull the whole app graph (a broken in-progress module elsewhere would take every harness down).
const devModules = import.meta.glob<{ default: ComponentType }>('./dev/*.tsx');
const devName = new URLSearchParams(location.search).get('dev');
const root = createRoot(document.getElementById('root')!);

async function boot() {
  const loader = devName ? devModules[`./dev/${devName}.tsx`] : undefined;
  const Root: ComponentType = loader ? (await loader()).default : (await import('./App')).default;
  root.render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}
void boot();
