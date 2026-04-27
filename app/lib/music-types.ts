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
// Difficulty Settings
// ============================================================

export type DifficultyLevel = "beginner" | "intermediate" | "advanced";

export type MusicStyle = "classical" | "jazz" | "chorale";

export type PracticeSettings = {
  difficulty: DifficultyLevel;
  style: MusicStyle;
  tempo: number;
  measures: number; // 4 or 8
  timeSignature: "4/4" | "3/4";
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
