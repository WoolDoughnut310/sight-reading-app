import OpenAI from "openai";
import type { Piece, PracticeSettings } from "./music-types";
import { validatePiece } from "./music-validator";
import { buildMusicXml } from "./musicxml-builder";

// ============================================================
// OpenAI client (server-only)
// ============================================================

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

// ============================================================
// Prompt builder
// ============================================================

const SCHEMA_DESCRIPTION = `
{
  "key": string,           // e.g. "C", "G", "F", "D", "Bb", "Eb"
  "mode": "major" | "minor",
  "timeSignature": string, // e.g. "4/4", "3/4"
  "tempo": number,         // BPM, 60-160
  "measures": [
    {
      "number": number,
      "rightHand": [ Note | Chord ],
      "leftHand":  [ Note | Chord ]
    }
  ]
}

Where:
  Note  = { "pitch": string, "duration": number, "tie"?: "start"|"stop", "slur"?: "start"|"stop", "ornament"?: "trill"|"grace"|null }
  Chord = { "notes": Note[] }

Duration values (divisions, quarter = 4):
  16 = whole note
   8 = half note
   4 = quarter note
   2 = eighth note
   1 = sixteenth note

Pitch format: "C4", "F#3", "Bb5" (letter + optional accidental + octave number)
`;

function buildPrompt(settings: PracticeSettings): string {
  const { difficulty, style, tempo, measures } = settings;

  const difficultyInstructions: Record<string, string> = {
    beginner: `
- Use only white keys (C major or A minor)
- Simple quarter and half note rhythms only
- Stepwise motion in the right hand (no leaps larger than a 3rd)
- Left hand: simple block chords (I, IV, V) on beats 1 and 3
- No ornaments
- Tempo: 60-80 BPM`,
    intermediate: `
- Use keys with 1-3 sharps or flats
- Mix of quarter, eighth, and half notes
- Right hand: melody with occasional 3rd and 5th leaps
- Left hand: broken chord patterns (Alberti bass or arpeggios)
- Occasional accidentals
- 1-2 ornaments (trills) allowed
- Tempo: 80-120 BPM`,
    advanced: `
- Use any key including flat/sharp keys
- Complex rhythms: dotted notes, syncopation, sixteenth notes
- Right hand: expressive melody with wide leaps, chromatic passing tones
- Left hand: independent melodic or contrapuntal lines
- Multiple ornaments (trills, grace notes)
- Ties and slurs across barlines
- Tempo: 100-160 BPM`,
  };

  const styleInstructions: Record<string, string> = {
    classical: `
Style: Classical/Romantic piano exercise
- Use functional harmony: I-IV-V-I progressions
- Clear phrase structure with cadences every 4 bars
- Balanced, symmetrical phrases
- Voice leading: smooth, minimal leaps in inner voices`,
    jazz: `
Style: Jazz piano exercise
- Use ii-V-I progressions
- Include 7th chords in left hand (e.g., Dm7, G7, Cmaj7)
- Syncopated rhythms in right hand
- Blue notes and chromatic approaches allowed
- Swing feel implied`,
    chorale: `
Style: Bach-style chorale
- Four-voice texture (SATB compressed to piano grand staff)
- Right hand: soprano + alto voices
- Left hand: tenor + bass voices
- Strict voice leading: no parallel 5ths or octaves
- Functional harmony with passing tones and suspensions`,
  };

  const timeSignature = settings.timeSignature;
  const divisionsPerMeasure = timeSignature === "3/4" ? 12 : 16;

  return `You are a professional composer and music theory expert.

Generate a piano sight-reading exercise as STRICT JSON only. No markdown, no prose, no code blocks.

JSON Schema:
${SCHEMA_DESCRIPTION}

Requirements:
- Exactly ${measures} measures
- Time signature: ${timeSignature}
- Each measure's rightHand durations MUST sum to exactly ${divisionsPerMeasure} divisions
- Each measure's leftHand durations MUST sum to exactly ${divisionsPerMeasure} divisions
- Right hand pitch range: C4 to C6 only
- Left hand pitch range: C2 to C4 only
- Tempo: ${tempo} BPM

Difficulty level: ${difficulty}
${difficultyInstructions[difficulty]}

${styleInstructions[style]}

CRITICAL RULES:
1. Return ONLY valid JSON — no text before or after
2. Every measure must have BOTH rightHand and leftHand arrays
3. Duration sums per measure must be EXACT (${divisionsPerMeasure} divisions for ${timeSignature})
4. Use functional harmony — not random notes
5. End with a clear cadence (V-I or ii-V-I)
6. Chord objects must have a "notes" array; Note objects must have "pitch" and "duration"

Return ONLY the JSON object.`;
}

// ============================================================
// LLM call with retry
// ============================================================

const MAX_RETRIES = 3;

export async function generateMusicPiece(settings: PracticeSettings): Promise<{
  piece: Piece;
  musicXml: string;
}> {
  const client = getOpenAIClient();
  const prompt = buildPrompt(settings);

  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: "openai/gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional composer. You output ONLY valid JSON music data. Never output markdown, prose, or code blocks. Only output the raw JSON object.",
          },
          {
            role: "user",
            content:
              attempt === 1
                ? prompt
                : `${prompt}\n\nPrevious attempt failed validation with these errors:\n${lastErrors.join("\n")}\n\nPlease fix these issues and return valid JSON.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      });

      const rawText = response.choices[0]?.message?.content ?? "";

      if (!rawText) {
        lastErrors = ["Empty response from LLM"];
        continue;
      }

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch (e) {
        lastErrors = [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`];
        continue;
      }

      // Validate
      const result = validatePiece(parsed);

      if (result.valid) {
        const musicXml = buildMusicXml(result.piece);
        return { piece: result.piece, musicXml };
      } else {
        lastErrors = result.errors;
        console.warn(`Attempt ${attempt} validation failed:`, result.errors);
      }
    } catch (error) {
      lastErrors = [error instanceof Error ? error.message : String(error)];
      console.error(`Attempt ${attempt} LLM call failed:`, error);
    }
  }

  throw new Error(
    `Failed to generate valid music after ${MAX_RETRIES} attempts. Last errors: ${lastErrors.join("; ")}`
  );
}
