// ============================================================
// Music Schema Types
// ============================================================

export type Note = {
  pitch: string; // "C4", "F#3", "Bb5"
  duration: number; // divisions: 1=16th, 2=8th, 4=quarter, 8=half, 16=whole
  tie?: "start" | "stop";
  slur?: "start" | "stop";
  ornament?: "trill" | "grace" | null;
};

export type Chord = {
  notes: Note[];
};

export type Measure = {
  number: number;
  rightHand: (Note | Chord)[];
  leftHand: (Note | Chord)[];
};

export type Piece = {
  key: string; // "C", "G", "F", "D", "Bb", etc.
  mode: "major" | "minor";
  timeSignature: string; // "4/4", "3/4", "6/8"
  tempo: number; // BPM
  measures: Measure[];
};

// ============================================================
// ABRSM Grade Settings (based on 2025-2026 Piano syllabus)
// ============================================================

export type AbrsmGrade = 
  | "initial"  // 4 bars, 4/4 or 2/4, C major/D minor, 5-finger position
  | "grade1"    // 4 bars, 3/4 or 4/4, G/F majors, A minor, 5-finger position
  | "grade2"    // 4 bars, D major, E/G minors, hands together
  | "grade3"    // up to 8 bars, 3/8, A/Bb/E majors, B minor, outside 5-finger
  | "grade4"    // c. 8 bars, 6/8, anacrusis, chromatic notes
  | "grade5"    // c. 8-12 bars, E/A majors, F#/C minors, syncopation
  | "grade6"    // c. 12-16 bars, 9/8, 5/8, 5/4, triplet rhythms
  | "grade7"    // c. 16-20 bars, 7/8, 7/4, tempo changes, 8va
  | "grade8";   // c. 1 page, 12/8, B/Db majors, ornaments, acceleration

export type MusicStyle = "classical" | "jazz" | "chorale";

export type PracticeSettings = {
  grade: AbrsmGrade;
  style: MusicStyle;
  tempo: number;
};

// ============================================================
// Validation Result
// ============================================================

export type ValidationResult =
  | { valid: true; piece: Piece }
  | { valid: false; errors: string[] };

// ============================================================
// Helper: check if item is a Chord
// ============================================================

export function isChord(item: Note | Chord): item is Chord {
  return "notes" in item;
}
