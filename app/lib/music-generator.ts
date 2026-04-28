import type { Piece, PracticeSettings, AbrsmGrade } from "./music-types";
import { validateAndConvertDSL } from "./dsl-parser";
import { buildMusicXml } from "./musicxml-builder";

// ============================================================
// ABRSM Sight-Reading Music Generator
// Based on ABRSM 2025-2026 Piano syllabus
// ============================================================

// True random for variability
function random(): number {
  return Math.random();
}

function randomInt(max: number): number {
  return Math.floor(random() * max);
}

// Scale degrees and their intervals
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

// Note names for pitch conversion
const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

// ABRSM Grade Parameters
interface GradeParams {
  measures: number;
  timeSignature: string;
  keys: { major: string[]; minor: string[] };
}

const GRADE_PARAMS: Record<AbrsmGrade, GradeParams> = {
  initial: { measures: 4, timeSignature: "4/4", keys: { major: ["C"], minor: ["D"] } },
  grade1: { measures: 4, timeSignature: "4/4", keys: { major: ["G", "F"], minor: ["A"] } },
  grade2: { measures: 4, timeSignature: "4/4", keys: { major: ["D"], minor: ["E", "G"] } },
  grade3: { measures: 8, timeSignature: "3/8", keys: { major: ["A", "Bb", "E"], minor: ["B"] } },
  grade4: { measures: 8, timeSignature: "6/8", keys: { major: ["C", "G", "F"], minor: ["D", "A", "E"] } },
  grade5: { measures: 8, timeSignature: "4/4", keys: { major: ["E", "A"], minor: ["F#", "C"] } },
  grade6: { measures: 8, timeSignature: "4/4", keys: { major: ["C", "F"], minor: ["C#", "F#"] } },
  grade7: { measures: 8, timeSignature: "4/4", keys: { major: ["G", "D", "A"], minor: ["E", "B", "F#"] } },
  grade8: { measures: 8, timeSignature: "4/4", keys: { major: ["G", "D"], minor: ["E", "B"] } },
};

function getKeyIndex(key: string): number {
  const keyMap: Record<string, number> = {
    "C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11,
    "C#": 0, "D#": 2, "F#": 6, "G#": 8, "A#": 10,
    "Db": 1, "Eb": 3, "Gb": 6, "Ab": 8, "Bb": 10,
  };
  return keyMap[key] ?? 0;
}

function noteToPitch(root: number, semitone: number, octave: number): string {
  const adjustedNote = ((root + semitone) % 12 + 12) % 12;
  const noteOctave = octave + Math.floor((root + semitone) / 12);
  return `${NOTE_NAMES[adjustedNote]}${noteOctave}`;
}

function getChordNotes(key: string, mode: "major" | "minor", chordSymbol: string, octave: number): string[] {
  const keyIndex = getKeyIndex(key);
  const scaleIntervals = SCALES[mode];
  const degreeMap: Record<string, number> = { "I": 0, "ii": 1, "iii": 2, "IV": 3, "V": 4, "vi": 5, "vii": 6 };
  const degreeIndex = degreeMap[chordSymbol] ?? 0;
  const rootSemitone = scaleIntervals[degreeIndex];
  const intervals = (chordSymbol === "ii" || chordSymbol === "iii" || chordSymbol === "vi") ? [0, 3, 7] : [0, 4, 7];
  return intervals.map((interval) => noteToPitch(keyIndex, rootSemitone + interval, octave));
}

// Random melody templates
const MELODY_TEMPLATES = [
  { degrees: [0, 2, 4, 2] },
  { degrees: [0, 4, 7, 4] },
  { degrees: [0, 1, 2, 1] },
  { degrees: [0, 4, 2, 4] },
  { degrees: [2, 4, 5, 4] },
  { degrees: [0, 5, 4, 2] },
  { degrees: [0, 1, 0, 2] },
  { degrees: [4, 2, 0, 2] },
  { degrees: [0, 2, 4, 5] },
  { degrees: [0, 1, 2, 4] },
];

// LH pattern types
const LH_PATTERNS = ["chord", "arpeggio", "broken", "alternating", "octave", "quint"];

function generateMelodyForGrade(grade: AbrsmGrade, key: string, mode: "major" | "minor"): string {
  const scaleIntervals = SCALES[mode];
  const keyIndex = getKeyIndex(key);
  const notes: string[] = [];
  const template = MELODY_TEMPLATES[randomInt(MELODY_TEMPLATES.length)];
  const baseOctave = 4 + randomInt(2);
  
  if (grade === "initial" || grade === "grade1" || grade === "grade2") {
    for (let i = 0; i < 4; i++) {
      const semitone = scaleIntervals[template.degrees[i] % 7];
      notes.push(`${noteToPitch(keyIndex, semitone, baseOctave)}:q`);
    }
  } else if (grade === "grade3") {
    for (let i = 0; i < 3; i++) {
      const semitone = scaleIntervals[template.degrees[i % 4] % 7];
      notes.push(`${noteToPitch(keyIndex, semitone, baseOctave)}:e`);
    }
  } else if (grade === "grade4") {
    for (let i = 0; i < 6; i++) {
      const semitone = scaleIntervals[template.degrees[i % 4] % 7];
      notes.push(`${noteToPitch(keyIndex, semitone, baseOctave)}:e`);
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const semitone = scaleIntervals[template.degrees[i] % 7];
      notes.push(`${noteToPitch(keyIndex, semitone, baseOctave)}:q`);
    }
  }
  return notes.join(" ");
}

function generateLeftHandForGrade(grade: AbrsmGrade, key: string, mode: "major" | "minor", chords: string[]): string {
  const keyIndex = getKeyIndex(key);
  const result: string[] = [];
  const lhPattern = LH_PATTERNS[randomInt(LH_PATTERNS.length)];
  
  if (grade === "grade3") {
    for (let i = 0; i < 3; i++) {
      const notes = getChordNotes(key, mode, chords[i % chords.length], 3);
      result.push(`[${notes.join(",")}]:e`);
    }
  } else if (grade === "grade4") {
    if (lhPattern === "broken") {
      const notes = getChordNotes(key, mode, chords[0], 3);
      const bp = [notes[0], notes[2], notes[1], notes[2], notes[0], notes[2]];
      for (const n of bp) result.push(`${n}:e`);
      return result.join(" ");
    }
    for (let i = 0; i < 6; i++) {
      const notes = getChordNotes(key, mode, chords[i % chords.length], 3);
      result.push(`[${notes.join(",")}]:e`);
    }
  } else {
    if (lhPattern === "arpeggio") {
      const notes = getChordNotes(key, mode, chords[0], 3);
      const bassNotes = notes.map((n) => n.replace(/[0-9]/g, '') + "3");
      const pat = [bassNotes[0], bassNotes[2], bassNotes[1], bassNotes[2]];
      for (const n of pat) result.push(`${n}:q`);
    } else if (lhPattern === "alternating") {
      const notes = getChordNotes(key, mode, chords[0], 3);
      const bassNotes = notes.map((n) => n.replace(/[0-9]/g, '') + "3");
      const pat = [bassNotes[0], bassNotes[1], bassNotes[0], bassNotes[1]];
      for (const n of pat) result.push(`${n}:q`);
    } else if (lhPattern === "octave") {
      for (const chord of chords) {
        const notes = getChordNotes(key, mode, chord, 3);
        const root = notes[0].replace(/[0-9]/g, '');
        result.push(`[${root}3,${root}4]:q`);
      }
    } else if (lhPattern === "quint") {
      for (const chord of chords) {
        const notes = getChordNotes(key, mode, chord, 3);
        const root = notes[0].replace(/[0-9]/g, '');
        const fifth = notes[2].replace(/[0-9]/g, '');
        result.push(`[${root}3,${fifth}3]:q`);
      }
    } else {
      for (const chord of chords) {
        const notes = getChordNotes(key, mode, chord, 3);
        const bassNotes = notes.map((n, i) => {
          const oct = parseInt(n.match(/[0-9]+/)?.[0] || "4");
          if (oct >= 5 && i > 0) return n.replace(/[0-9]+/, "4");
          return n;
        });
        result.push(`[${bassNotes.join(",")}]:q`);
      }
    }
  }
  return result.join(" ");
}

function getChordsForMeasure(style: string, measureIndex: number): string[] {
  const progressions: Record<string, string[][]> = {
    classical: [["I", "IV", "V", "I"], ["I", "ii", "IV", "V"], ["I", "IV", "ii", "V"], ["I", "V", "IV", "I"], ["IV", "V", "I", "IV"]],
    jazz: [["ii7", "V7", "I", "ii7"], ["ii7", "V7", "I", "V7"], ["IV7", "V7", "I", "IV7"], ["ii7", "IV7", "V7", "I"]],
    chorale: [["I", "IV", "I", "V"], ["I", "IV", "V", "I"], ["I", "IV", "I", "IV"], ["IV", "V", "I", "I"]],
  };
  return (progressions[style] || progressions.classical)[measureIndex % (progressions[style]?.length || 4)];
}

export function generateMusicPiece(settings: PracticeSettings): { piece: Piece; musicXml: string } {
  const { grade, style, tempo } = settings;
  const params = GRADE_PARAMS[grade];
  const mode: "major" | "minor" = "major";
  
  let dsl = `META key=C mode=${mode} time=${params.timeSignature} tempo=${tempo}\n\n`;
  
  for (let m = 1; m <= params.measures; m++) {
    dsl += `M${m}\n`;
    const key = params.keys.major[m - 1 % params.keys.major.length];
    const chords = getChordsForMeasure(style, m - 1);
    dsl += `RH: ${generateMelodyForGrade(grade, key, mode)}\n`;
    dsl += `LH: ${generateLeftHandForGrade(grade, key, mode, chords)}\n\n`;
  }
  
  const result = validateAndConvertDSL(dsl);
  if (!result.valid) throw new Error(`Generation failed: ${result.errors.join(", ")}`);
  
  return { piece: result.piece, musicXml: buildMusicXml(result.piece) };
}