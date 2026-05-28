import { useEffect, useState } from 'react';

// Splash al primo avvio: insegna neon che si accende, fa bloom e atterra in topbar.
// Compare UNA volta sola per dispositivo (flag in localStorage). Skip al tap.
const KEY = 'parcheggio.splashSeen';

export function shouldShowSplash() {
  try { return !localStorage.getItem(KEY); } catch { return false; }
}
function markSeen() {
  try { localStorage.setItem(KEY, '1'); } catch {}
}

export default function SplashIntro({ onDone }) {
  const [fase, setFase] = useState('ignite'); // 'ignite' | 'land'

  useEffect(() => {
    const t1 = setTimeout(() => setFase('land'), 1800);
    const t2 = setTimeout(() => { markSeen(); onDone(); }, 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  function salta() {
    markSeen();
    onDone();
  }

  return (
    <div className={`splash ${fase}`} onClick={salta} aria-hidden="true">
      <img src="/lido-america.png" className="splash-logo" alt="" />
    </div>
  );
}
