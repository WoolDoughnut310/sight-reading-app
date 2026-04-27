import type { Note, Chord, Measure, Piece, ValidationResult } from "./music-types";
import { isChord } from "./music-types";

// ============================================================
// Duration totals per time signature (in divisions, 4=quarter)
// ============================================================

const DIVISIONS_PER_QUARTER = 4;

function getExpectedDivisionsPerMeasure(timeSignature: string): number {
  const [num, denom] = timeSignature.split("/").map(Number);
  // divisions per beat = DIVISIONS_PER_QUARTER / (denom / 4)
  const divisionsPerBeat = DIVISIONS_PER_QUARTER * (4 / denom);
  return num * divisionsPerBeat;
}

function sumDurations(items: (Note | Chord)[]): number {
  return items.reduce((total, item) => {
    if (isChord(item)) {
      // A chord's duration is the duration of its first note
      return total + (item.notes[0]?.duration ?? 0);
    }
    return total + item.duration;
  }, 0);
}

// ============================================================
// Pitch validation
// ============================================================

const VALID_PITCH_REGEX = /^[A-G][#b]?\d$/;

const RH_MIN_OCTAVE = 4;
const RH_MAX_OCTAVE = 6;
const LH_MIN_OCTAVE = 2;
const LH_MAX_OCTAVE = 4;

function clampPitch(pitch: string, minOctave: number, maxOctave: number): string {
  const match = pitch.match(/^([A-G][#b]?)(\d)$/);
  if (!match) return pitch;
  const [, noteName, octaveStr] = match;
  const octave = Math.max(minOctave, Math.min(maxOctave, parseInt(octaveStr)));
  return `${noteName}${octave}`;
}

function clampNotePitch(note: Note, minOctave: number, maxOctave: number): Note {
  return { ...note, pitch: clampPitch(note.pitch, minOctave, maxOctave) };
}

function clampItemPitches(
  item: Note | Chord,
  minOctave: number,
  maxOctave: number
): Note | Chord {
  if (isChord(item)) {
    return { notes: item.notes.map((n) => clampNotePitch(n, minOctave, maxOctave)) };
  }
  return clampNotePitch(item, minOctave, maxOctave);
}

// ============================================================
// Duration validity
// ============================================================

const VALID_DURATIONS = new Set([1, 2, 4, 8, 16]);

function validateDuration(d: number): boolean {
  return VALID_DURATIONS.has(d);
}

// ============================================================
// Main validator
// ============================================================

export function validatePiece(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["Response is not an object"] };
  }

  const obj = raw as Record<string, unknown>;

  // Top-level fields
  if (typeof obj.key !== "string" || !obj.key) {
    errors.push("Missing or invalid 'key'");
  }
  if (obj.mode !== "major" && obj.mode !== "minor") {
    errors.push("'mode' must be 'major' or 'minor'");
  }
  if (typeof obj.timeSignature !== "string" || !/^\d+\/\d+$/.test(obj.timeSignature as string)) {
    errors.push("'timeSignature' must be like '4/4'");
  }
  if (typeof obj.tempo !== "number" || obj.tempo < 40 || obj.tempo > 240) {
    errors.push("'tempo' must be a number between 40 and 240");
  }
  if (!Array.isArray(obj.measures) || obj.measures.length < 4 || obj.measures.length > 8) {
    errors.push("'measures' must be an array of 4–8 items");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const timeSignature = obj.timeSignature as string;
  const expectedDivisions = getExpectedDivisionsPerMeasure(timeSignature);
  const measures = obj.measures as unknown[];

  const validatedMeasures: Measure[] = [];

  for (let i = 0; i < measures.length; i++) {
    const m = measures[i] as Record<string, unknown>;
    const measureErrors: string[] = [];

    if (!Array.isArray(m.rightHand)) {
      measureErrors.push(`Measure ${i + 1}: 'rightHand' must be an array`);
    }
    if (!Array.isArray(m.leftHand)) {
      measureErrors.push(`Measure ${i + 1}: 'leftHand' must be an array`);
    }

    if (measureErrors.length > 0) {
      errors.push(...measureErrors);
      continue;
    }

    // Parse and clamp items
    const rightHand = parseAndClampItems(
      m.rightHand as unknown[],
      RH_MIN_OCTAVE,
      RH_MAX_OCTAVE,
      `Measure ${i + 1} RH`,
      errors
    );
    const leftHand = parseAndClampItems(
      m.leftHand as unknown[],
      LH_MIN_OCTAVE,
      LH_MAX_OCTAVE,
      `Measure ${i + 1} LH`,
      errors
    );

    // Validate rhythmic totals
    const rhTotal = sumDurations(rightHand);
    const lhTotal = sumDurations(leftHand);

    if (Math.abs(rhTotal - expectedDivisions) > 0.5) {
      errors.push(
        `Measure ${i + 1} RH duration ${rhTotal} ≠ expected ${expectedDivisions} (time sig ${timeSignature})`
      );
    }
    if (Math.abs(lhTotal - expectedDivisions) > 0.5) {
      errors.push(
        `Measure ${i + 1} LH duration ${lhTotal} ≠ expected ${expectedDivisions} (time sig ${timeSignature})`
      );
    }

    validatedMeasures.push({
      number: i + 1,
      rightHand,
      leftHand,
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const piece: Piece = {
    key: obj.key as string,
    mode: obj.mode as "major" | "minor",
    timeSignature,
    tempo: obj.tempo as number,
    measures: validatedMeasures,
  };

  return { valid: true, piece };
}

function parseAndClampItems(
  raw: unknown[],
  minOctave: number,
  maxOctave: number,
  label: string,
  errors: string[]
): (Note | Chord)[] {
  const result: (Note | Chord)[] = [];

  for (let j = 0; j < raw.length; j++) {
    const item = raw[j] as Record<string, unknown>;

    if (Array.isArray(item.notes)) {
      // It's a chord
      const notes: Note[] = [];
      for (const n of item.notes as unknown[]) {
        const note = parseNote(n, `${label} chord[${j}]`, errors);
        if (note) notes.push(clampNotePitch(note, minOctave, maxOctave));
      }
      if (notes.length > 0) {
        result.push({ notes });
      }
    } else {
      // It's a note
      const note = parseNote(item, `${label}[${j}]`, errors);
      if (note) {
        result.push(clampNotePitch(note, minOctave, maxOctave));
      }
    }
  }

  return result;
}

function parseNote(
  raw: unknown,
  label: string,
  errors: string[]
): Note | null {
  if (!raw || typeof raw !== "object") {
    errors.push(`${label}: not an object`);
    return null;
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.pitch !== "string" || !VALID_PITCH_REGEX.test(obj.pitch)) {
    // Try to fix common issues
    if (typeof obj.pitch === "string") {
      // Accept it anyway, will be clamped
    } else {
      errors.push(`${label}: invalid pitch '${obj.pitch}'`);
      return null;
    }
  }

  const duration = Number(obj.duration);
  if (!validateDuration(duration)) {
    errors.push(`${label}: invalid duration ${obj.duration}`);
    return null;
  }

  const note: Note = {
    pitch: obj.pitch as string,
    duration,
  };

  if (obj.tie === "start" || obj.tie === "stop") note.tie = obj.tie;
  if (obj.slur === "start" || obj.slur === "stop") note.slur = obj.slur;
  if (obj.ornament === "trill" || obj.ornament === "grace") note.ornament = obj.ornament;

  return note;
}
