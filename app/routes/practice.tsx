import { Form, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/practice";
import { generateMusicPiece } from "~/lib/music-generator";
import type { DifficultyLevel, MusicStyle, PracticeSettings } from "~/lib/music-types";
import { SheetMusicViewer } from "~/components/SheetMusicViewer";
import { PracticeControls } from "~/components/PracticeControls";

// ============================================================
// Meta
// ============================================================

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Piano Sight-Reading Trainer" },
    { name: "description", content: "AI-powered piano sight-reading exercises" },
  ];
}

// ============================================================
// Loader — no initial exercise (user must generate)
// ============================================================

export async function loader(_: Route.LoaderArgs) {
  return { ready: true };
}

// ============================================================
// Action — generate music via LLM pipeline
// ============================================================

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  const difficulty = (formData.get("difficulty") as DifficultyLevel) ?? "beginner";
  const style = (formData.get("style") as MusicStyle) ?? "classical";
  const tempo = parseInt((formData.get("tempo") as string) ?? "80", 10);
  const measures = parseInt((formData.get("measures") as string) ?? "4", 10);
  const timeSignatureRaw = (formData.get("timeSignature") as string) ?? "4/4";
  const timeSignature: "4/4" | "3/4" = timeSignatureRaw === "3/4" ? "3/4" : "4/4";

  const settings: PracticeSettings = {
    difficulty,
    style,
    tempo: isNaN(tempo) ? 80 : Math.max(40, Math.min(200, tempo)),
    measures: isNaN(measures) ? 4 : Math.max(4, Math.min(8, measures)),
    timeSignature,
  };

  try {
    const { piece, musicXml } = await generateMusicPiece(settings);

    return {
      success: true as const,
      musicXml,
      settings,
      pieceInfo: {
        key: piece.key,
        mode: piece.mode,
        timeSignature: piece.timeSignature,
        tempo: piece.tempo,
        measureCount: piece.measures.length,
      },
      error: null,
    };
  } catch (err) {
    return {
      success: false as const,
      musicXml: null,
      settings,
      pieceInfo: null,
      error: err instanceof Error ? err.message : "Unknown error occurred",
    };
  }
}

// ============================================================
// Component
// ============================================================

export default function PracticePage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isGenerating = navigation.state === "submitting";

  const currentSettings = actionData?.settings;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎼</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                Sight Reading Trainer
              </h1>
              <p className="text-xs text-gray-500">AI-powered piano exercises</p>
            </div>
          </div>

          {actionData?.pieceInfo && (
            <div className="hidden sm:flex items-center gap-4 text-sm text-gray-600">
              <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-medium">
                {actionData.pieceInfo.key} {actionData.pieceInfo.mode}
              </span>
              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                {actionData.pieceInfo.timeSignature}
              </span>
              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                ♩ = {actionData.pieceInfo.tempo}
              </span>
              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                {actionData.pieceInfo.measureCount} bars
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Controls Form */}
        <Form method="post">
          <PracticeControls
            defaultDifficulty={currentSettings?.difficulty ?? "beginner"}
            defaultStyle={currentSettings?.style ?? "classical"}
            defaultTempo={currentSettings?.tempo ?? 80}
            defaultMeasures={currentSettings?.measures ?? 4}
            defaultTimeSignature={currentSettings?.timeSignature ?? "4/4"}
          />
        </Form>

        {/* Error display */}
        {actionData?.success === false && actionData.error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <span className="text-red-500 text-xl mt-0.5">⚠️</span>
              <div>
                <h3 className="font-semibold text-red-800 mb-1">Generation Failed</h3>
                <p className="text-red-700 text-sm">{actionData.error}</p>
                <p className="text-red-500 text-xs mt-2">
                  Make sure OPENAI_API_KEY is set in your environment variables.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sheet Music Display */}
        {actionData?.success && actionData.musicXml ? (
          <div className="space-y-4">
            {/* Piece info bar (mobile) */}
            {actionData.pieceInfo && (
              <div className="sm:hidden flex flex-wrap gap-2 text-sm">
                <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-medium">
                  {actionData.pieceInfo.key} {actionData.pieceInfo.mode}
                </span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  {actionData.pieceInfo.timeSignature}
                </span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  ♩ = {actionData.pieceInfo.tempo}
                </span>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <span>🎵</span>
                  Your Exercise
                </h2>
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                  Grand Staff
                </span>
              </div>
              <SheetMusicViewer musicXml={actionData.musicXml} />
            </div>
          </div>
        ) : !isGenerating ? (
          /* Empty state */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="text-6xl mb-4">🎹</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Ready to Practice?
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Configure your settings above and click{" "}
              <strong className="text-indigo-600">Generate Exercise</strong> to create a
              personalized sight-reading piece using AI.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm text-gray-400">
              <span>✓ Functional harmony</span>
              <span>✓ Proper voice leading</span>
              <span>✓ Grand staff notation</span>
              <span>✓ Adjustable difficulty</span>
            </div>
          </div>
        ) : (
          /* Generating state */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <div>
                <h2 className="text-xl font-semibold text-gray-700 mb-1">
                  Composing your exercise…
                </h2>
                <p className="text-gray-500 text-sm">
                  The AI is generating a musically valid piece with proper harmony and voice leading.
                </p>
              </div>
              <div className="flex gap-2 text-xs text-gray-400 mt-2">
                <span className="animate-pulse">Stage 1: LLM composition</span>
                <span>→</span>
                <span className="animate-pulse delay-500">Stage 2: MusicXML build</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-gray-200 py-6 text-center text-xs text-gray-400">
        <p>Piano Sight-Reading Trainer · Powered by GPT-4.1 Mini + OpenSheetMusicDisplay</p>
      </footer>
    </div>
  );
}
