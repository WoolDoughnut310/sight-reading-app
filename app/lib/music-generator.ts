import type { Piece, PracticeSettings, AbrsmGrade } from "./music-types";
import { validateAndConvertDSL } from "./dsl-parser";
import { buildMusicXml } from "./musicxml-builder";

// ============================================================
// ABRSM Sight-Reading Music Generator
// Based on ABRSM 2025-2026 Piano syllabus
// ============================================================

function random(): number { return Math.random(); }
function randomInt(max: number): number { return Math.floor(random() * max); }

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

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

const MELODY_TEMPLATES = [
  { degrees: [0, 2, 4, 2] }, { degrees: [0, 4, 7, 4] }, { degrees: [0, 1, 2, 1] },
  { degrees: [0, 4, 2, 4] }, { degrees: [2, 4, 5, 4] }, { degrees: [0, 5, 4, 2] },
  { degrees: [0, 1, 0, 2] }, { degrees: [4, 2, 0, 2] }, { degrees: [0, 2, 4, 5] }, { degrees: [0, 1, 2, 4] },
];

const LH_PATTERNS = ["chord", "arpeggio", "broken", "alternating", "octave", "quint"];

// Grade 4: Anacrusis (pickup notes at start)
function generateAnacrusis(baseOctave: number, keyIndex: number, scaleIntervals: number[]): string {
  const pickupNotes = randomInt(2) + 1;
  const notes: string[] = [];
  for (let i = 0; i < pickupNotes; i++) {
    const degree = [0, 1, 2][randomInt(3)];
    const semitone = scaleIntervals[degree % 7];
    notes.push(`${noteToPitch(keyIndex, semitone, baseOctave)}:e`);
  }
  return notes.join(" ");
}

// Grade 5: Syncopation patterns
function generateSyncopation(baseOctave: number, keyIndex: number, scaleIntervals: number[]): string {
  const patterns = [
    ["e", "q", "e", "e"],
    ["e.", "e", "q", "q"],
    ["q", "e", "e", "q"],
    ["e", "e", "q.", "e"],
  ];
  const pattern = patterns[randomInt(patterns.length)];
  const notes: string[] = [];
  const template = MELODY_TEMPLATES[randomInt(MELODY_TEMPLATES.length)];
  for (let i = 0; i < 4; i++) {
    const semitone = scaleIntervals[template.degrees[i % 4] % 7];
    notes.push(`${noteToPitch(keyIndex, semitone, baseOctave)}:${pattern[i]}`);
  }
  return notes.join(" ");
}

// Grade 6: Triplets
function generateTripletPattern(baseOctave: number, keyIndex: number, scaleIntervals: number[]): string {
  const hasTriplet = random() > 0.5;
  if (hasTriplet) {
    return `${noteToPitch(keyIndex, scaleIntervals[0], baseOctave)}:e.t ${noteToPitch(keyIndex, scaleIntervals[2], baseOctave)}:t ${noteToPitch(keyIndex, scaleIntervals[4], baseOctave)}:t ${noteToPitch(keyIndex, scaleIntervals[2], baseOctave)}:q`;
  }
  const notes: string[] = [];
  const template = MELODY_TEMPLATES[randomInt(MELODY_TEMPLATES.length)];
  for (let i = 0; i < 4; i++) {
    const semitone = scaleIntervals[template.degrees[i % 4] % 7];
    notes.push(`${noteToPitch(keyIndex, semitone, baseOctave)}:q`);
  }
  return notes.join(" ");
}

// Grade 8: Ornaments (trills, mordents, turns)
function generateOrnamentedMelody(baseOctave: number, keyIndex: number, scaleIntervals: number[]): string {
  const notes: string[] = [];
  const template = MELODY_TEMPLATES[randomInt(MELODY_TEMPLATES.length)];
  
  for (let i = 0; i < 4; i++) {
    const semitone = scaleIntervals[template.degrees[i % 4] % 7];
    const pitch = noteToPitch(keyIndex, semitone, baseOctave);
    
    if (random() > 0.7 && (i === 0 || i === 2)) {
      const ornaments = ["trill", "mord", "turn"];
      const ornament = ornaments[randomInt(3)];
      notes.push(`(${ornament})${pitch}:q`);
    } else {
      notes.push(`${pitch}:q`);
    }
  }
  return notes.join(" ");
}

// Grade 7: Tempo changes
function getModifiedTempo(baseTempo: number, measureIndex: number): number {
  if (measureIndex === 0) return baseTempo;
  if (measureIndex >= 6) {
    const changes = [-10, -15, 10, 15, 0];
    return baseTempo + changes[randomInt(changes.length)];
  }
  return baseTempo;
}

function generateMelodyForGrade(grade: AbrsmGrade, key: string, mode: "major" | "minor", measureIndex: number): string {
  const scaleIntervals = SCALES[mode];
  const keyIndex = getKeyIndex(key);
  const baseOctave = 4 + randomInt(2);
  
  // Grade 4: 6/8 with anacrusis
  if (grade === "grade4") {
    if (measureIndex === 0 && random() > 0.5) {
      return generateAnacrusis(baseOctave, keyIndex, scaleIntervals) + " " + generateAnacrusis(baseOctave, keyIndex, scaleIntervals);
    }
    const notes: string[] = [];
    for (let i = 0; i < 6; i++) {
      const semitone = scaleIntervals[randomInt(7)];
      notes.push(`${noteToPitch(keyIndex, semitone, baseOctave)}:e`);
    }
    return notes.join(" ");
  }
  
  // Grade 5: Syncopation
  if (grade === "grade5") {
    return generateSyncopation(baseOctave, keyIndex, scaleIntervals);
  }
  
  // Grade 6: Triplets
  if (grade === "grade6") {
    return generateTripletPattern(baseOctave, keyIndex, scaleIntervals);
  }
  
  // Grade 8: Ornaments
  if (grade === "grade8") {
    return generateOrnamentedMelody(baseOctave, keyIndex, scaleIntervals);
  }
  
  // Grade 3: 3/8 time
  if (grade === "grade3") {
    const notes: string[] = [];
    for (let i = 0; i < 3; i++) {
      const semitone = scaleIntervals[randomInt(7)];
      notes.push(`${noteToPitch(keyIndex, semitone, baseOctave)}:e`);
    }
    return notes.join(" ");
  }
  
  // Default: simple patterns
  const template = MELODY_TEMPLATES[randomInt(MELODY_TEMPLATES.length)];
  const notes: string[] = [];
  for (let i = 0; i < 4; i++) {
    const semitone = scaleIntervals[template.degrees[i % 4] % 7];
    notes.push(`${noteToPitch(keyIndex, semitone, baseOctave)}:q`);
  }
  return notes.join(" ");
}

function generateLeftHandForGrade(grade: AbrsmGrade, key: string, mode: "major" | "minor", chords: string[]): string {
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
  
  // Grade 7 tempo changes at end
  const effectiveTempo = grade === "grade7" ? getModifiedTempo(tempo, 7) : tempo;
  
  let dsl = `META key=C mode=${mode} time=${params.timeSignature} tempo=${effectiveTempo}\n\n`;
  
  for (let m = 1; m <= params.measures; m++) {
    dsl += `M${m}\n`;
    const key = params.keys.major[(m - 1) % params.keys.major.length];
    const chords = getChordsForMeasure(style, m - 1);
    
    // Grade 7: vary tempo per measure
    const measureTempo = grade === "grade7" ? getModifiedTempo(tempo, m - 1) : effectiveTempo;
    if (grade === "grade7" && m > 1) {
      dsl = dsl.replace(/tempo=\d+/, `tempo=${measureTempo}`);
    }
    
    dsl += `RH: ${generateMelodyForGrade(grade, key, mode, m - 1)}\n`;
    dsl += `LH: ${generateLeftHandForGrade(grade, key, mode, chords)}\n\n`;
  }
  
  const result = validateAndConvertDSL(dsl);
  if (!result.valid) throw new Error(`Generation failed: ${result.errors.join(", ")}`);
  
  return { piece: result.piece, musicXml: buildMusicXml(result.piece) };
}