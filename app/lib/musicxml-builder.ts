import type { Note, Chord, Piece } from "./music-types";
import { isChord } from "./music-types";

// ============================================================
// Timing/Debug Utilities
// ============================================================

function debugTime(label: string, startTime?: number): number {
  const now = performance.now();
  if (startTime !== undefined) {
    const elapsed = now - startTime;
    console.debug(`[TIMING] ${label}: ${elapsed.toFixed(2)}ms`);
  }
  return now;
}

// ============================================================
// MusicXML Builder — Deterministic Stage 2
// ============================================================

const DIVISIONS = 4; // quarter note = 4 divisions

// ============================================================
// Key signature helpers
// ============================================================

const KEY_FIFTHS: Record<string, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  "F#": 6,
  "C#": 7,
  F: -1,
  Bb: -2,
  Eb: -3,
  Ab: -4,
  Db: -5,
  Gb: -6,
  Cb: -7,
  // Minor keys (relative)
  Am: 0,
  Em: 1,
  Bm: 2,
  "F#m": 3,
  "C#m": 4,
  "G#m": 5,
  "D#m": 6,
  Dm: -1,
  Gm: -2,
  Cm: -3,
  Fm: -4,
  Bbm: -5,
  Ebm: -6,
};

function getFifths(key: string, mode: "major" | "minor"): number {
  const lookup = mode === "minor" ? `${key}m` : key;
  return KEY_FIFTHS[lookup] ?? KEY_FIFTHS[key] ?? 0;
}

// ============================================================
// Duration type mapping
// ============================================================

function durationToType(divisions: number): string {
  switch (divisions) {
    case 16:
      return "whole";
    case 8:
      return "half";
    case 4:
      return "quarter";
    case 2:
      return "eighth";
    case 1:
      return "16th";
    default:
      return "quarter";
  }
}

// ============================================================
// Pitch parsing
// ============================================================

function parsePitch(pitch: string): { step: string; alter: number; octave: number } {
  const match = pitch.match(/^([A-G])([#b]?)(\d)$/);
  if (!match) {
    return { step: "C", alter: 0, octave: 4 };
  }
  const [, step, accidental, octaveStr] = match;
  const alter = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return { step, alter, octave: parseInt(octaveStr) };
}

// ============================================================
// XML helpers
// ============================================================

function tag(name: string, content: string, attrs: Record<string, string | number> = {}): string {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("");
  if (content === "") return `<${name}${attrStr}/>`;
  return `<${name}${attrStr}>${content}</${name}>`;
}

function indent(xml: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return xml
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}

// ============================================================
// Note XML builder
// ============================================================

function buildNoteXml(
  note: Note,
  voice: number,
  staff: number,
  isChordNote: boolean = false
): string {
  const { step, alter, octave } = parsePitch(note.pitch);
  const type = durationToType(note.duration);

  let xml = "";

  if (isChordNote) {
    xml += "<chord/>\n";
  }

  xml += "<pitch>\n";
  xml += `  <step>${step}</step>\n`;
  if (alter !== 0) {
    xml += `  <alter>${alter}</alter>\n`;
  }
  xml += `  <octave>${octave}</octave>\n`;
  xml += "</pitch>\n";
  xml += `<duration>${note.duration}</duration>\n`;

  if (note.tie === "start") {
    xml += '<tie type="start"/>\n';
  } else if (note.tie === "stop") {
    xml += '<tie type="stop"/>\n';
  }

  xml += `<voice>${voice}</voice>\n`;
  xml += `<type>${type}</type>\n`;
  xml += `<staff>${staff}</staff>\n`;

  // Notations
  const notations: string[] = [];

  if (note.tie === "start") {
    notations.push('<tied type="start"/>');
  } else if (note.tie === "stop") {
    notations.push('<tied type="stop"/>');
  }

  if (note.slur === "start") {
    notations.push('<slur type="start" number="1"/>');
  } else if (note.slur === "stop") {
    notations.push('<slur type="stop" number="1"/>');
  }

  if (note.ornament === "trill") {
    notations.push("<ornaments><trill-mark/></ornaments>");
  }

  if (notations.length > 0) {
    xml += `<notations>${notations.join("")}</notations>\n`;
  }

  return tag("note", "\n" + indent(xml, 2));
}

// ============================================================
// Measure XML builder
// ============================================================

function buildMeasureXml(
  measure: { number: number; rightHand: (Note | Chord)[]; leftHand: (Note | Chord)[] },
  isFirst: boolean,
  key: string,
  mode: "major" | "minor",
  timeSignature: string,
  tempo: number
): string {
  const [beats, beatType] = timeSignature.split("/");
  const fifths = getFifths(key, mode);

  let content = "";

  // Attributes (first measure only)
  if (isFirst) {
    content += "<attributes>\n";
    content += `  <divisions>${DIVISIONS}</divisions>\n`;
    content += "  <key>\n";
    content += `    <fifths>${fifths}</fifths>\n`;
    content += `    <mode>${mode}</mode>\n`;
    content += "  </key>\n";
    content += "  <time>\n";
    content += `    <beats>${beats}</beats>\n`;
    content += `    <beat-type>${beatType}</beat-type>\n`;
    content += "  </time>\n";
    content += "  <staves>2</staves>\n";
    content += "  <clef number=\"1\">\n";
    content += "    <sign>G</sign>\n";
    content += "    <line>2</line>\n";
    content += "  </clef>\n";
    content += "  <clef number=\"2\">\n";
    content += "    <sign>F</sign>\n";
    content += "    <line>4</line>\n";
    content += "  </clef>\n";
    content += "</attributes>\n";

    // Tempo direction
    content += "<direction placement=\"above\">\n";
    content += "  <direction-type>\n";
    content += `    <metronome parentheses="no">\n`;
    content += "      <beat-unit>quarter</beat-unit>\n";
    content += `      <per-minute>${tempo}</per-minute>\n`;
    content += "    </metronome>\n";
    content += "  </direction-type>\n";
    content += `  <sound tempo="${tempo}"/>\n`;
    content += "</direction>\n";
  }

  // Right hand notes (staff 1, voice 1)
  for (const item of measure.rightHand) {
    if (isChord(item)) {
      const [first, ...rest] = item.notes;
      content += buildNoteXml(first, 1, 1, false) + "\n";
      for (const n of rest) {
        content += buildNoteXml(n, 1, 1, true) + "\n";
      }
    } else {
      content += buildNoteXml(item, 1, 1, false) + "\n";
    }
  }

  // Backup to start of measure for left hand
  const [numBeats, denomBeats] = timeSignature.split("/").map(Number);
  const totalDivisions = numBeats * DIVISIONS * (4 / denomBeats);
  content += `<backup><duration>${totalDivisions}</duration></backup>\n`;

  // Left hand notes (staff 2, voice 2)
  for (const item of measure.leftHand) {
    if (isChord(item)) {
      const [first, ...rest] = item.notes;
      content += buildNoteXml(first, 2, 2, false) + "\n";
      for (const n of rest) {
        content += buildNoteXml(n, 2, 2, true) + "\n";
      }
    } else {
      content += buildNoteXml(item, 2, 2, false) + "\n";
    }
  }

  return tag("measure", "\n" + indent(content, 4), { number: measure.number });
}

// ============================================================
// Main builder
// ============================================================

export function buildMusicXml(piece: Piece): string {
  const overallStart = debugTime("buildMusicXml:start");

  const measuresStart = debugTime("buildMusicXml:build measures start");
  const measures = piece.measures
    .map((m, i) =>
      buildMeasureXml(m, i === 0, piece.key, piece.mode, piece.timeSignature, piece.tempo)
    )
    .join("\n");
  debugTime("buildMusicXml:build measures done", measuresStart);

  const partContentStart = debugTime("buildMusicXml:build part content start");
  const partContent = `
<part id="P1">
${indent(measures, 2)}
</part>`;
  debugTime("buildMusicXml:build part content done", partContentStart);

  const scoreContentStart = debugTime("buildMusicXml:build score content start");
  const scoreContent = `
<work>
  <work-title>Sight Reading Exercise</work-title>
</work>
<identification>
  <encoding>
    <software>Sight Reading App</software>
  </encoding>
</identification>
<part-list>
  <score-part id="P1">
    <part-name>Piano</part-name>
    <score-instrument id="P1-I1">
      <instrument-name>Piano</instrument-name>
    </score-instrument>
  </score-part>
</part-list>
${partContent}`;
  debugTime("buildMusicXml:build score content done", scoreContentStart);

  const finalXmlStart = debugTime("buildMusicXml:final assembly start");
  const result = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
${indent(scoreContent, 2)}
</score-partwise>`;
  debugTime("buildMusicXml:final assembly done", finalXmlStart);
  debugTime("buildMusicXml:complete", overallStart);

  return result;
}
