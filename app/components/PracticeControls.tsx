import { useNavigation } from "react-router";
import type { DifficultyLevel, MusicStyle } from "~/lib/music-types";

interface PracticeControlsProps {
  defaultDifficulty?: DifficultyLevel;
  defaultStyle?: MusicStyle;
  defaultTempo?: number;
  defaultMeasures?: number;
  defaultTimeSignature?: "4/4" | "3/4";
}

// ============================================================
// PracticeControls — form for generating new exercises
// ============================================================

export function PracticeControls({
  defaultDifficulty = "beginner",
  defaultStyle = "classical",
  defaultTempo = 80,
  defaultMeasures = 4,
  defaultTimeSignature = "4/4",
}: PracticeControlsProps) {
  const navigation = useNavigation();
  const isGenerating = navigation.state === "submitting";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
        <span className="text-2xl">🎹</span>
        Practice Settings
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Difficulty */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="difficulty" className="text-sm font-medium text-gray-600">
            Difficulty
          </label>
          <select
            id="difficulty"
            name="difficulty"
            defaultValue={defaultDifficulty}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
          >
            <option value="beginner">🌱 Beginner</option>
            <option value="intermediate">🎵 Intermediate</option>
            <option value="advanced">🎼 Advanced</option>
          </select>
        </div>

        {/* Style */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="style" className="text-sm font-medium text-gray-600">
            Style
          </label>
          <select
            id="style"
            name="style"
            defaultValue={defaultStyle}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
          >
            <option value="classical">🎻 Classical</option>
            <option value="jazz">🎷 Jazz</option>
            <option value="chorale">⛪ Bach Chorale</option>
          </select>
        </div>

        {/* Time Signature */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="timeSignature" className="text-sm font-medium text-gray-600">
            Time Signature
          </label>
          <select
            id="timeSignature"
            name="timeSignature"
            defaultValue={defaultTimeSignature}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
          >
            <option value="4/4">4/4 — Common time</option>
            <option value="3/4">3/4 — Waltz time</option>
          </select>
        </div>

        {/* Tempo */}
        <div className="flex flex-col gap-1.5 sm:col-span-1">
          <label htmlFor="tempo" className="text-sm font-medium text-gray-600">
            Tempo (BPM)
          </label>
          <div className="flex items-center gap-3">
            <input
              id="tempo"
              name="tempo"
              type="range"
              min={40}
              max={200}
              step={5}
              defaultValue={defaultTempo}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-sm font-mono text-gray-700 w-12 text-right">
              {defaultTempo}
            </span>
          </div>
        </div>

        {/* Measures */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="measures" className="text-sm font-medium text-gray-600">
            Length
          </label>
          <select
            id="measures"
            name="measures"
            defaultValue={defaultMeasures}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
          >
            <option value={4}>4 measures</option>
            <option value={8}>8 measures</option>
          </select>
        </div>
      </div>

      {/* Generate button */}
      <button
        type="submit"
        name="intent"
        value="generate"
        disabled={isGenerating}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 shadow-sm"
      >
        {isGenerating ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <span>✨</span>
            Generate Exercise
          </>
        )}
      </button>
    </div>
  );
}
