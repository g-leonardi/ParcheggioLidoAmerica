import { useEffect, useState } from 'react';

// Dopo un minuto senza tocchi l'app si annerisce: su schermi OLED i pixel neri
// sono spenti, e il bianco ad alta luminosità (necessario sotto il sole) è la
// voce di consumo più grossa della giornata. Il primo tap riporta tutto com'era.
// NON è il blocco schermo del telefono: non si passa dal PIN.
//
// Solo app operatore (montato da OperatorApp): nel pannello Manager si guardano
// grafici e liste stando fermi a leggere, e un nero automatico sarebbe un danno.
const ATTESA_MS = 60 * 1000;

// Via di fuga senza redeploy, stesso schema del flag ?debug=1 in Ingresso.jsx:
// aprendo l'app con ?standby=0 lo si disattiva su quel telefono finché non si
// riapre con ?standby=1.
const ATTIVO = (() => {
  try {
    const q = new URLSearchParams(location.search).get('standby');
    if (q === '0') localStorage.setItem('parcheggio.standby', '0');
    if (q === '1') localStorage.removeItem('parcheggio.standby');
    return localStorage.getItem('parcheggio.standby') !== '0';
  } catch { return true; }
})();

export default function Standby() {
  const [nero, setNero] = useState(false);

  useEffect(() => {
    if (!ATTIVO) return;
    let t;
    const riarma = () => {
      clearTimeout(t);
      t = setTimeout(() => setNero(true), ATTESA_MS);
    };
    // Qualunque segno di vita rimanda il nero. In cattura (true) così conta
    // anche quando l'evento viene fermato da un handler dei componenti sotto.
    const eventi = ['pointerdown', 'keydown', 'wheel', 'touchmove'];
    eventi.forEach((e) => window.addEventListener(e, riarma, { capture: true, passive: true }));
    // Tornare sull'app (dopo il blocco schermo o un'altra app) è un segno di
    // vita: si riparte accesi, non con un velo nero da togliere.
    const suRitorno = () => {
      if (document.visibilityState === 'visible') {
        setNero(false);
        riarma();
      }
    };
    document.addEventListener('visibilitychange', suRitorno);
    riarma();
    return () => {
      clearTimeout(t);
      eventi.forEach((e) => window.removeEventListener(e, riarma, { capture: true }));
      document.removeEventListener('visibilitychange', suRitorno);
    };
  }, []);

  if (!nero) return null;

  // Il velo copre tutto, quindi il tap che sveglia arriva QUI e non al bottone
  // che sta sotto: nessun "CONFERMA INGRESSO" premuto per sbaglio al risveglio.
  // Sveglia su click (non su pointerdown) proprio per non lasciare che l'evento
  // successivo del tocco finisca sull'elemento scoperto.
  return (
    <div
      className="standby"
      onClick={(e) => {
        e.stopPropagation();
        setNero(false);
      }}
      role="button"
      aria-label="Schermo in pausa: tocca per riprendere"
    >
      <span>tocca per riprendere</span>
    </div>
  );
}
