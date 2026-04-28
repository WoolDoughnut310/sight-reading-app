import { useNavigation } from "react-router";
import type { AbrsmGrade, MusicStyle } from "~/lib/music-types";

interface PracticeControlsProps {
  defaultDifficulty?: AbrsmGrade;
  defaultStyle?: MusicStyle;
  defaultTempo?: number;
}

const ABRSM_GRADES: { value: AbrsmGrade; label: string }[] = [
  { value: "initial", label: "📖 Initial (4 bars, C major, 4/4)" },
  { value: "grade1", label: "🌱 Grade 1 (4 bars, G/F majors, 4/4)" },
  { value: "grade2", label: "🎵 Grade 2 (4 bars, D major, hands together)" },
  { value: "grade3", label: "🎼 Grade 3 (8 bars, A/Bb/E majors, 3/8)" },
  { value: "grade4", label: "🎹 Grade 4 (8 bars, 6/8, anacrusis)" },
  { value: "grade5", label: "🎸 Grade 5 (8 bars, syncopation, E/A)" },
  { value: "grade6", label: "🎻 Grade 6 (8 bars, triplets, 4/4)" },
  { value: "grade7", label: "🎤 Grade 7 (8 bars, tempo changes, 4/4)" },
  { value: "grade8", label: "⭐ Grade 8 (8 bars, ornaments, 4/4)" },
];

// ============================================================
// PracticeControls — form for generating new exercises
// ============================================================

export function PracticeControls({
  defaultDifficulty = "grade1",
  defaultStyle = "classical",
  defaultTempo = 80,
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
        {/* ABRSM Grade */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="difficulty" className="text-sm font-medium text-gray-600">
            ABRSM Grade
          </label>
          <select
            id="difficulty"
            name="difficulty"
            defaultValue={defaultDifficulty}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
          >
            {ABRSM_GRADES.map((grade) => (
              <option key={grade.value} value={grade.value}>
                {grade.label}
              </option>
            ))}
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