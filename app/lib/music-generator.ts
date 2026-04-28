import OpenAI from "openai";
import type { Piece, PracticeSettings } from "./music-types";
import { validateAndConvertDSL } from "./dsl-parser";
import { buildMusicXml } from "./musicxml-builder";

function debugTime(label: string, startTime?: number): number {
  const now = performance.now();
  if (startTime !== undefined) {
    const elapsed = now - startTime;
    console.debug(`[TIMING] ${label}: ${elapsed.toFixed(2)}ms`);
  }
  return now;
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ 
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  });
}

function buildPrompt(settings: PracticeSettings): string {
  const { difficulty, style, tempo, measures } = settings;
  const timeSignature = settings.timeSignature;
  const beats = timeSignature.split("/")[0];
  const beatType = timeSignature.split("/")[1];

  const totalDivisions = parseInt(beats) * 4 * (4 / parseInt(beatType));

  const difficultyInstructions: Record<string, string> = {
    beginner: `
DIFFICULTY: BEGINNER
- Key: C major or G major only (no sharps/flats)
- RH: simple melody, stepwise motion only (no leaps)
- LH: block chords on beats 1 and 3 (I, IV, V)
- Note lengths: quarter (q) and half (h) notes only
- No ornaments, no ties, no slurs
- 4 measures only
- Tempo: ${tempo} BPM`,
    intermediate: `
DIFFICULTY: INTERMEDIATE
- Key: up to 3 sharps or flats
- RH: melody with some leaps (3rds, 5ths)
- LH: Alberti bass or broken chords
- Note lengths: include eighth (e) notes
- Add 1-2 trill ornaments
- Include dynamics: (mf), (f), (p)
- 4 measures`,
    advanced: `
DIFFICULTY: ADVANCED
- Key: any key
- RH: expressive melody with chromaticism
- LH: independent accompaniment patterns
- Note lengths: sixteenth (s) notes OK
- Add ornaments: (trill), (mordent)
- Add ties: C4:q(tie-start) ... C4:q(tie-stop)
- 4-8 measures`,
  };

  const styleInstructions: Record<string, string> = {
    classical: `
STYLE: Classical
- Functional harmony: I - IV - V - I in each phrase
- End with authentic cadence (V - I)
- Balanced 4-bar phrases`,
    jazz: `
STYLE: Jazz
- ii-V-I progressions
- Left hand: 7th chords
- Syncopated rhythms in RH
- Blue notes allowed`,
    chorale: `
STYLE: Chorale (Bach-style)
- Four-voice texture
- Strict voice leading
- Use passing tones
- No parallel 5ths/octaves`,
  };

  return `You are a professional composer. Generate piano music using this DSL:

META key=G mode=major time=4/4 tempo=80

M1
RH: C4:q D4:q E4:q F4:q
LH: [C3,E3,G3]:h [F3,A3,C4]:h

M2
RH: E4:q G4:q C5:q D5:q
LH: [A3,C4,E4]:h [G3,B3,D4]:h

## DSL FORMAT:

META key=<key> mode=<major|minor> time=<beats>/<beat> tempo=<bpm>

M<n>
RH: <voice content>
LH: <voice content>

## NOTES:
- Pitch: C4, F#3, Bb2 (letter + optional #/b + octave)
- Rest: R:q
- Durations: w=whole(16 divisions), h=half(8 divisions), q=quarter(4 divisions), e=eighth(2 divisions), s=sixteenth(1 divisions)
- Dotted (adds half the base): w.=24 divisions, h.=12 divisions, q.=6 divisions, e.=3 divisions, s.=1.5 divisions
- In ${timeSignature} each measure must total exactly ${totalDivisions} divisions. Double-check your math before outputting.
- EXAMPLE CHECK: C4:q D4:q E4:q F4:q = 4+4+4+4 = 16 divisions ✓

## CHORDS:
[C4,E4,G4]:q

## MODIFIERS (after duration):
- (trill), (mordent), (turn)
- (accent), (staccato), (tenuto)
- (tie-start), (tie-stop)
- (slur-start), (slur-stop)
- (mf), (f), (p), (pp)

## RULES:
- ${measures} measures
- Time: ${timeSignature} (= ${totalDivisions} divisions per measure)
- RH range: C4 to C6
- LH range: C2 to C4
- Each measure RH and LH must total ${totalDivisions} divisions exactly
- Must use functional harmony (I, IV, V, ii, vi, iii, vii°)
- End with cadence (V→I or ii→V→I)

${difficultyInstructions[difficulty]}
${styleInstructions[style]}

OUTPUT ONLY THE DSL - no explanations, no JSON, no markdown.`;

}

const MAX_RETRIES = 3;

export async function generateMusicPiece(settings: PracticeSettings): Promise<{
  piece: Piece;
  musicXml: string;
}> {
  const overallStart = debugTime("generateMusicPiece:start");
  const client = getOpenAIClient();
  
  const promptStart = debugTime("buildPrompt:start");
  const prompt = buildPrompt(settings);
  debugTime("buildPrompt:done", promptStart);

  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const attemptStart = debugTime(`Attempt ${attempt}:start`);
    try {
      const llmStart = debugTime(`Attempt ${attempt}:LLM call start`);
      const response = await client.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You output ONLY the DSL music format. No JSON, no prose, no markdown code blocks. Only raw DSL.",
          },
          {
            role: "user",
            content: attempt === 1
              ? prompt
              : `${prompt}\n\nPrevious attempt failed validation:\n${lastErrors.join("\n")}\n\nFix these issues and return valid DSL.`,
          },
        ],
        temperature: 0.1
      });
      debugTime(`Attempt ${attempt}:LLM call done`, llmStart);

      const rawText = response.choices[0]?.message?.content?.trim() ?? "";

      if (!rawText) {
        lastErrors = ["Empty response from LLM"];
        continue;
      }
      
      const cleanDsl = rawText
      .replace(/^```dsl\n?/g, "")
      .replace(/^```\n?$/g, "")
      .replace(/^```music\n?/g, "")
      .trim();
      
      const parseStart = debugTime(`Attempt ${attempt}:DSL parse start`);
      const result = validateAndConvertDSL(cleanDsl);
      debugTime(`Attempt ${attempt}:DSL parse done`, parseStart);

      if (result.valid) {
        const xmlStart = debugTime(`Attempt ${attempt}:MusicXML build start`);
        const musicXml = buildMusicXml(result.piece);
        debugTime(`Attempt ${attempt}:MusicXML build done`, xmlStart);
        debugTime(`Attempt ${attempt}:complete`, attemptStart);
        debugTime("generateMusicPiece:complete", overallStart);
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