import { useState } from 'react';
import OperatorApp from './OperatorApp.jsx';
import Superuser from './admin/Superuser.jsx';
import SplashIntro, { shouldShowSplash } from './SplashIntro.jsx';

// Router minimale via pathname: /admin = area responsabile, tutto il resto = app operatore.
export default function App() {
  const admin = window.location.pathname.startsWith('/admin');
  // L'app vera sta sotto e parte subito: lo splash è solo un overlay decorativo
  // al primo avvio. Niente ritardi sui caricamenti successivi.
  const [splash, setSplash] = useState(shouldShowSplash());
  return (
    <>
      {admin ? <Superuser /> : <OperatorApp />}
      {splash && <SplashIntro onDone={() => setSplash(false)} />}
    </>
  );
}
