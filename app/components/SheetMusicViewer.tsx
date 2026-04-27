import { useEffect, useRef, useState } from "react";

interface SheetMusicViewerProps {
  musicXml: string;
}

// ============================================================
// SheetMusicViewer — renders MusicXML via OpenSheetMusicDisplay
// ============================================================

export function SheetMusicViewer({ musicXml }: SheetMusicViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!musicXml || !containerRef.current) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function render() {
      try {
        // Dynamically import OSMD (client-only, large bundle)
        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");

        if (cancelled || !containerRef.current) return;

        // Clear previous render
        containerRef.current.innerHTML = "";

        // Create or reuse OSMD instance
        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          backend: "svg",
          drawTitle: false,
          drawSubtitle: false,
          drawComposer: false,
          drawLyricist: false,
          drawCredits: false,
          drawPartNames: false,
          drawMeasureNumbers: true,
          drawTimeSignatures: true,
          followCursor: false,
          defaultColorMusic: "#1a1a2e",
          pageFormat: "Endless",
          pageBackgroundColor: "#ffffff",
        });

        osmdRef.current = osmd;

        await osmd.load(musicXml);

        if (cancelled) return;

        osmd.render();
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error("OSMD render error:", err);
          setError(err instanceof Error ? err.message : "Failed to render sheet music");
          setLoading(false);
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [musicXml]);

  return (
    <div className="relative w-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500 font-medium">Rendering notation…</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <strong>Render error:</strong> {error}
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full min-h-[300px] bg-white rounded-xl shadow-inner border border-gray-100"
        style={{ fontFamily: "serif" }}
      />
    </div>
  );
}
