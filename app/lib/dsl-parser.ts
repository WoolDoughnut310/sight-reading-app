import type { Note, Chord, Measure, Piece, ValidationResult } from "./music-types";
import { isChord } from "./music-types";

const DIVISIONS_PER_QUARTER = 4;

export type ParsedNote = {
  pitch: string;
  duration: number;
  tie?: "start" | "stop";
  slur?: "start" | "stop";
  ornament?: string;
  modifiers: string[];
  isRest: boolean;
};

export type ParsedChord = {
  notes: ParsedNote[];
  duration: number;
  modifiers: string[];
};

export type ParsedMeasure = {
  number: number;
  rightHand: (ParsedNote | ParsedChord)[];
  leftHand: (ParsedNote | ParsedChord)[];
};

export type ParsedPiece = {
  key: string;
  mode: "major" | "minor";
  timeSignature: string;
  tempo: number;
  measures: ParsedMeasure[];
};

const NOTE_DURATIONS: Record<string, number> = {
  w: 16,
  h: 8,
  q: 4,
  e: 2,
  s: 1,
};

const PITCH_REGEX = /^([A-G])([#b]?)(\d+)$/;
const REST_PITCH = "R";

function parsePitch(pitch: string): { step: string; alter: number; octave: number; isRest: boolean } {
  if (pitch === "R") {
    return { step: "R", alter: 0, octave: 0, isRest: true };
  }
  const match = pitch.match(PITCH_REGEX);
  if (!match) {
    return { step: "C", alter: 0, octave: 4, isRest: false };
  }
  const [, step, accidental, octaveStr] = match;
  const alter = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return { step, alter, octave: parseInt(octaveStr), isRest: false };
}

function parseDuration(durationStr: string): { duration: number; isDotted: boolean } {
  let base = durationStr.replace(/\.+$/, "");
  let dots = (durationStr.match(/\./g) || []).length;
  let dur = NOTE_DURATIONS[base] || 4;
  
  if (dots > 0) {
    let multiplier = 1;
    let divisor = 1;
    for (let i = 0; i < dots; i++) {
      divisor *= 2;
      multiplier += 1 / divisor;
    }
    dur = Math.round(dur * multiplier);
  }
  
  return { duration: dur, isDotted: dots > 0 };
}

function parseModifiers(modStr: string): string[] {
  const matches = modStr.match(/\([^)]+\)/g) || [];
  return matches.map(m => m.slice(1, -1));
}

function parseNote(noteStr: string, defaultDuration?: number): ParsedNote {
  const colonIdx = noteStr.lastIndexOf(":");
  if (colonIdx === -1) {
    // No duration specified, use default or fallback
    const { step, alter, octave, isRest } = parsePitch(noteStr);
    let actualPitch = "";
    if (isRest) {
      actualPitch = "R";
    } else {
      const altStr = alter === 1 ? "#" : alter === -1 ? "b" : "";
      actualPitch = `${step}${altStr}${octave}`;
    }
    return {
      pitch: actualPitch,
      duration: defaultDuration ?? 4,
      modifiers: [],
      isRest,
    };
  }

  const pitchPart = noteStr.slice(0, colonIdx);
  const durationPart = noteStr.slice(colonIdx + 1);

  const { step, alter, octave, isRest } = parsePitch(pitchPart);
  const { duration } = parseDuration(durationPart);
  const modifiers = parseModifiers(noteStr);

  let actualPitch = "";
  if (isRest) {
    actualPitch = "R";
  } else {
    const altStr = alter === 1 ? "#" : alter === -1 ? "b" : "";
    actualPitch = `${step}${altStr}${octave}`;
  }

  const ornament = modifiers.find(m => 
    ["trill", "mordent", "turn", "accent", "staccato", "tenuto"].includes(m)
  ) || undefined;

  let tie: ParsedNote["tie"];
  if (modifiers.includes("tie-start")) tie = "start";
  else if (modifiers.includes("tie-stop")) tie = "stop";

  let slur: ParsedNote["slur"];
  if (modifiers.includes("slur-start")) slur = "start";
  else if (modifiers.includes("slur-stop")) slur = "stop";

  return {
    pitch: actualPitch,
    duration,
    tie,
    slur,
    ornament,
    modifiers,
    isRest,
  };
}

function parseVoice(voiceStr: string, allowChords: boolean): (ParsedNote | ParsedChord)[] {
  const results: (ParsedNote | ParsedChord)[] = [];
  
  const chordRegex = /\[([^\]]+)\]:(\w+\.?)?/g;
  let lastIndex = 0;
  let match;

  const chordMatches: { start: number; end: number; content: string; duration: string }[] = [];
  while ((match = chordRegex.exec(voiceStr)) !== null) {
    chordMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[1],
      duration: match[2] || "q",
    });
  }

  let currentIndex = 0;
  for (const cm of chordMatches) {
    if (cm.start > currentIndex) {
      const beforeStr = voiceStr.slice(currentIndex, cm.start).trim();
      if (beforeStr) {
        const notes = beforeStr.split(/\s+/).filter(n => n.trim());
        for (const noteStr of notes) {
          results.push(parseNote(noteStr));
        }
      }
    }

    if (allowChords) {
      const chordNotes = cm.content.split(",").map(n => n.trim());
      const { duration } = parseDuration(cm.duration);
      const modifiers = parseModifiers(cm.content);
      results.push({
        notes: chordNotes.map(n => parseNote(n, duration)),
        duration,
        modifiers,
      });
    }

    currentIndex = cm.end;
  }

  if (currentIndex < voiceStr.length) {
    const afterStr = voiceStr.slice(currentIndex).trim();
    if (afterStr) {
      const notes = afterStr.split(/\s+/).filter(n => n.trim());
      for (const noteStr of notes) {
        results.push(parseNote(noteStr));
      }
    }
  }

  return results;
}

function parseMeasure(measureLines: string[], measureNum: number): ParsedMeasure {
  let rhData = "";
  let lhData = "";

  for (const line of measureLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("RH:")) {
      rhData = trimmed.slice(3).trim();
    } else if (trimmed.startsWith("LH:")) {
      lhData = trimmed.slice(3).trim();
    }
  }

  return {
    number: measureNum,
    rightHand: parseVoice(rhData, true),
    leftHand: parseVoice(lhData, true),
  };
}

export function parseDSL(dsl: string): ParsedPiece {
  const lines = dsl.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  
  let key = "C";
  let mode: "major" | "minor" = "major";
  let timeSignature = "4/4";
  let tempo = 80;

  const measureBlocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    if (line.startsWith("META")) {
      const metaMatch = line.match(/key=(\w+)/);
      if (metaMatch) key = metaMatch[1];
      
      const modeMatch = line.match(/mode=(major|minor)/);
      if (modeMatch) mode = modeMatch[1] as "major" | "minor";
      
      const timeMatch = line.match(/time=(\d+\/\d+)/);
      if (timeMatch) timeSignature = timeMatch[1];
      
      const tempoMatch = line.match(/tempo=(\d+)/);
      if (tempoMatch) tempo = parseInt(tempoMatch[1]);
    } else if (/^M\d+$/.test(line)) {
      if (currentBlock.length > 0) {
        measureBlocks.push(currentBlock);
      }
      currentBlock = [];
    } else if (line.startsWith("RH:") || line.startsWith("LH:")) {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    measureBlocks.push(currentBlock);
  }

  const measures = measureBlocks.map((block, idx) => parseMeasure(block, idx + 1));

  return { key, mode, timeSignature, tempo, measures };
}

function getExpectedDivisionsPerMeasure(timeSignature: string): number {
  const [num, denom] = timeSignature.split("/").map(Number);
  const divisionsPerBeat = DIVISIONS_PER_QUARTER * (4 / denom);
  return num * divisionsPerBeat;
}

function sumDurations(items: (ParsedNote | ParsedChord)[]): number {
  return items.reduce((total, item) => {
    if ("notes" in item) {
      return total + (item.duration || item.notes[0]?.duration || 0);
    }
    return total + item.duration;
  }, 0);
}

function convertParsedToPiece(parsed: ParsedPiece): Piece {
  const expectedDivisions = getExpectedDivisionsPerMeasure(parsed.timeSignature);

  const measures: Measure[] = parsed.measures.map((m, idx) => {
    const rhNotes = m.rightHand.map(item => convertItem(item));
    const lhNotes = m.leftHand.map(item => convertItem(item));
    
    return {
      number: idx + 1,
      rightHand: rhNotes,
      leftHand: lhNotes,
    };
  });

  return {
    key: parsed.key,
    mode: parsed.mode,
    timeSignature: parsed.timeSignature,
    tempo: parsed.tempo,
    measures,
  };
}

function convertItem(item: ParsedNote | ParsedChord): Note | Chord {
  if ("notes" in item) {
    return {
      notes: item.notes.map(n => convertNote(n)),
    };
  }
  return convertNote(item);
}

function convertNote(note: ParsedNote): Note {
  return {
    pitch: note.isRest ? "C4" : note.pitch,
    duration: note.duration,
    tie: note.tie,
    slur: note.slur,
    ornament: note.ornament as "trill" | "grace" | undefined,
  };
}

export function validateAndConvertDSL(dsl: string): ValidationResult {
  const errors: string[] = [];

  try {
    console.log(dsl);
    const parsed = parseDSL(dsl);

    if (!parsed.key) errors.push("Missing key in META");
    if (parsed.mode !== "major" && parsed.mode !== "minor") {
      errors.push("Mode must be 'major' or 'minor'");
    }
    if (!parsed.timeSignature) errors.push("Missing time signature");
    if (parsed.measures.length < 4 || parsed.measures.length > 8) {
      errors.push("Must have 4-8 measures");
    }

    const expectedDivisions = getExpectedDivisionsPerMeasure(parsed.timeSignature);

    for (let i = 0; i < parsed.measures.length; i++) {
      const m = parsed.measures[i];
      
      if (m.rightHand.length === 0) {
        errors.push(`Measure ${i + 1}: missing RH content`);
      }
      if (m.leftHand.length === 0) {
        errors.push(`Measure ${i + 1}: missing LH content`);
      }

      const rhTotal = sumDurations(m.rightHand);
      const lhTotal = sumDurations(m.leftHand);

      if (Math.abs(rhTotal - expectedDivisions) > 0.5) {
        errors.push(
          `Measure ${i + 1} RH: ${rhTotal} ≠ ${expectedDivisions} divisions`
        );
      }
      if (Math.abs(lhTotal - expectedDivisions) > 0.5) {
        errors.push(
          `Measure ${i + 1} LH: ${lhTotal} ≠ ${expectedDivisions} divisions`
        );
      }

      for (const item of [...m.rightHand, ...m.leftHand]) {
        const items = "notes" in item ? item.notes : [item];
        for (const n of items) {
          if (n.isRest) continue;
          const { step, octave } = parsePitch(n.pitch);
          const isRH = m.rightHand.includes(item);
          const minOctave = isRH ? 4 : 2;
          const maxOctave = isRH ? 6 : 4;
          if (octave < minOctave || octave > maxOctave) {
            errors.push(
              `Measure ${i + 1}: pitch ${n.pitch} out of range for ${isRH ? "RH" : "LH"}`
            );
          }
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const piece = convertParsedToPiece(parsed);
    return { valid: true, piece };
  } catch (e) {
    return {
      valid: false,
      errors: [`DSL parse error: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}