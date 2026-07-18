import React from 'react';
import { useTranslation } from 'react-i18next';
import { Radio } from 'lucide-react';

interface PlayReactButtonProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onAddClip: (start: number, end: number) => void;
  lookback?: number; // retroactive buffer seconds
}

/**
 * Mode 2 "Play & React": hold while watching, release to capture the moment.
 * Records start = currentTime - lookback (capped at 0), end = currentTime.
 */
export const PlayReactButton: React.FC<PlayReactButtonProps> = ({ videoRef, onAddClip, lookback = 2.0 }) => {
  const { t } = useTranslation();
  const startRef = React.useRef<number | null>(null);
  const [holding, setHolding] = React.useState(false);

  const down = () => {
    const v = videoRef.current;
    if (!v) return;
    startRef.current = Math.max(0, v.currentTime - lookback);
    setHolding(true);
  };

  const up = () => {
    const v = videoRef.current;
    if (!v || startRef.current === null) {
      setHolding(false);
      return;
    }
    const end = v.currentTime;
    const start = startRef.current;
    startRef.current = null;
    setHolding(false);
    if (end > start + 0.1) onAddClip(start, end);
  };

  return (
    <button
      type="button"
      onMouseDown={down}
      onMouseUp={up}
      onMouseLeave={() => holding && up()}
      className={`w-full py-8 rounded-card border-2 text-lg font-semibold flex flex-col items-center justify-center gap-2 transition-all select-none ${
        holding
          ? 'bg-error/20 border-error text-error scale-[0.99]'
          : 'bg-accent/10 border-accent text-accent hover:bg-accent/20'
      }`}
    >
      <Radio className={`w-8 h-8 ${holding ? 'animate-pulse' : ''}`} />
      {holding ? t('smartEditor.recording', 'Merekam…') : t('smartEditor.holdToRecord', 'Tahan Untuk Klip')}
    </button>
  );
};
