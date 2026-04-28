// Test script for ABRSM grade generation
import { generateMusicPiece } from './app/lib/music-generator';

const grades = ["initial", "grade1", "grade2", "grade3", "grade4", "grade5", "grade6", "grade7", "grade8"] as const;

console.log('Testing all ABRSM grades...\n');

for (const grade of grades) {
  try {
    const result = generateMusicPiece({ grade, style: 'classical', tempo: 80 });
    console.log(`✓ ${grade}: ${result.piece.measures.length} measures, key: ${result.piece.key}, time: ${result.piece.timeSignature}`);
  } catch (e) {
    console.error(`✗ ${grade} failed:`, e);
  }
}

console.log('\nAll ABRSM grade tests complete!');
