/**
 * StreamingText - anime l'apparition caractere par caractere (typewriter).
 *
 * Source de design : https://api.anthropic.com/v1/design/h/OmRt6vG0zFEcaQUG3wXDDQ
 * (Text Streaming Animations). Adaptation Brutal Invoice :
 *   - PAS de fade/blur (clashe avec zero-radius, ombres plates).
 *   - Typewriter pur a ~40 chars/sec (tunable via `cps` prop) pilote en rAF
 *     pour synchro avec le refresh ecran (60fps).
 *   - Flush 100ms quand `streaming=false` pour eviter le "rattrapage long"
 *     a la fin.
 *   - React.memo sur le rendu final pour ne pas reparser le markdown a
 *     chaque tick - pendant le typewriter on affiche du texte brut
 *     (whiteSpace: pre-wrap), et on bascule sur le markdown complet a la
 *     fin via le composant parent.
 *
 * Perf :
 *   - Le buffer (incoming text) vit dans une ref, pas dans un state - pas
 *     de re-render inutile a chaque chunk recu.
 *   - Le tick incremente un state `displayLen` au max 1 tick / frame.
 *   - requestAnimationFrame ajuste `charsPerMs` en fonction du delta reel
 *     entre frames pour une vitesse stable meme si le tab lag.
 */

import { type ReactElement, memo, useEffect, useRef, useState } from "react";

interface StreamingTextProps {
  /** Texte complet recu (croit a chaque tick pendant le streaming). */
  text: string;
  /** True tant que l'API stream - a la fin, on flushe le reste. */
  streaming: boolean;
  /** Chars/s. Defaut 50 (compromis lisibilite / reactivite). */
  cps?: number;
}

function StreamingTextImpl({ text, streaming, cps = 50 }: StreamingTextProps): ReactElement {
  const [displayLen, setDisplayLen] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  // Refs pour eviter de re-binder l'effet a chaque tick (sinon boucle infinie).
  const textRef = useRef(text);
  const streamingRef = useRef(streaming);
  const cpsRef = useRef(cps);
  const displayLenRef = useRef(0);

  textRef.current = text;
  streamingRef.current = streaming;
  cpsRef.current = cps;
  displayLenRef.current = displayLen;

  useEffect(() => {
    // On ne dependend QUE du mount / unmount - toutes les valeurs live sont
    // lues via refs pour eviter une boucle d'effets.
    const tick = (now: number): void => {
      if (lastTimeRef.current === 0) lastTimeRef.current = now;
      const deltaMs = now - lastTimeRef.current;
      lastTimeRef.current = now;

      const curCps = cpsRef.current;
      const flushRate = curCps * 20;
      const rate = streamingRef.current ? curCps : flushRate;
      const charsToAdd = Math.max(1, Math.floor((deltaMs * rate) / 1000));
      const targetLen = textRef.current.length;

      if (displayLenRef.current < targetLen) {
        const next = Math.min(targetLen, displayLenRef.current + charsToAdd);
        displayLenRef.current = next;
        setDisplayLen(next);
      } else if (displayLenRef.current > targetLen) {
        // Reset : le buffer a ete retracte.
        displayLenRef.current = targetLen;
        setDisplayLen(targetLen);
      }

      const shouldContinue = streamingRef.current || displayLenRef.current < textRef.current.length;

      if (shouldContinue) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimeRef.current = 0;
    };
  }, []);

  // Quand le stream se termine ou que text grandit alors qu'on etait a jour,
  // reveiller le rAF (il se peut qu'il ait stoppe apres avoir atteint targetLen).
  useEffect(() => {
    if (rafRef.current === null && displayLenRef.current < text.length) {
      rafRef.current = requestAnimationFrame((now) => {
        // Reinjecter un tick - meme logique que dans le useEffect mount.
        if (lastTimeRef.current === 0) lastTimeRef.current = now;
        const deltaMs = now - lastTimeRef.current;
        lastTimeRef.current = now;
        const curCps = cpsRef.current;
        const rate = streamingRef.current ? curCps : curCps * 20;
        const charsToAdd = Math.max(1, Math.floor((deltaMs * rate) / 1000));
        const targetLen = textRef.current.length;
        if (displayLenRef.current < targetLen) {
          const next = Math.min(targetLen, displayLenRef.current + charsToAdd);
          displayLenRef.current = next;
          setDisplayLen(next);
        }
        rafRef.current = null;
      });
    }
  }, [text, streaming]);

  // Pendant l'animation on affiche du texte brut (whitespace pre-wrap) -
  // reparser le markdown a chaque frame serait trop couteux. Le parent
  // basculera sur ChatMessageContent quand streaming=false ET buffer complet.
  const visible = text.slice(0, displayLen);

  return (
    <div
      data-testid="streaming-text"
      data-streaming={streaming ? "true" : "false"}
      data-len={displayLen}
      style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
    >
      {visible}
    </div>
  );
}

export const StreamingText = memo(StreamingTextImpl);
