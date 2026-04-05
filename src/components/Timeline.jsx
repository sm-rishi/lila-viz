import { formatTime } from '../utils/format';

export default function Timeline({ currentT, maxT, playing, onSeek, onPlayPause, speed, onSpeedChange }) {
  const pct = maxT > 0 ? (currentT / maxT) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-t border-gray-700">
      {/* Play/Pause */}
      <button
        onClick={onPlayPause}
        disabled={maxT === 0}
        className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center justify-center text-white text-sm flex-shrink-0 transition-colors"
      >
        {playing ? '⏸' : '▶'}
      </button>

      {/* Time label */}
      <span className="text-xs font-mono text-gray-400 flex-shrink-0 w-20">
        {formatTime(currentT)} / {formatTime(maxT)}
      </span>

      {/* Scrubber */}
      <div className="flex-1 relative h-5 flex items-center group">
        <div className="absolute left-0 right-0 h-1 bg-gray-700 rounded">
          <div
            className="h-full bg-blue-500 rounded"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={maxT}
          value={currentT}
          onChange={e => onSeek(Number(e.target.value))}
          disabled={maxT === 0}
          className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed h-full"
        />
      </div>

      {/* Speed selector */}
      <div className="flex rounded border border-gray-600 overflow-hidden flex-shrink-0">
        {[1, 2, 4, 8].map(s => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-2 py-1 text-xs transition-colors ${
              speed === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
