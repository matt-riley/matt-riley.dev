export interface DrumPattern {
  rows: [number, number, number, number];
  tempo: number;
  swing: number;
}
export const drumRows = ["kick", "snare", "hat", "open hat"] as const;
const bits = (...steps: number[]) =>
  steps.reduce((mask, step) => mask | (1 << step), 0);
const presets = {
  "Head nod": [
    bits(0, 6, 8, 11),
    bits(4, 12),
    bits(0, 2, 4, 6, 8, 10, 12, 14),
    bits(7, 15),
  ],
  "Late bus": [
    bits(0, 3, 8, 10),
    bits(4, 12),
    bits(0, 2, 3, 6, 8, 10, 11, 14),
    bits(7, 15),
  ],
  Sunday: [bits(0, 7, 10), bits(4, 12), bits(0, 4, 6, 8, 12, 14), bits(2, 10)],
} as const;
export type PresetName = keyof typeof presets;
export function presetPattern(name: PresetName): DrumPattern {
  return {
    rows: [...presets[name]] as DrumPattern["rows"],
    tempo: 88,
    swing: 58,
  };
}
function valid(pattern: DrumPattern) {
  return (
    Number.isInteger(pattern.tempo) &&
    pattern.tempo >= 70 &&
    pattern.tempo <= 110 &&
    Number.isInteger(pattern.swing) &&
    pattern.swing >= 50 &&
    pattern.swing <= 66 &&
    pattern.rows.length === 4 &&
    pattern.rows.every(
      (mask) => Number.isInteger(mask) && mask >= 0 && mask <= 65535,
    )
  );
}
/** Eleven bytes: version, tempo, swing and four 16-bit rows. No visitor data. */
export function encodePattern(pattern: DrumPattern) {
  if (!valid(pattern)) throw new RangeError("Invalid drum pattern");
  const bytes = [1, pattern.tempo - 70, pattern.swing - 50];
  for (const row of pattern.rows) bytes.push(row >>> 8, row & 255);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
export function decodePattern(code: string): DrumPattern | undefined {
  if (!/^[A-Za-z0-9_-]{15}$/.test(code)) return;
  try {
    const bytes = [
      ...atob(`${code.replaceAll("-", "+").replaceAll("_", "/")}=`),
    ].map((character) => character.charCodeAt(0));
    if (bytes.length !== 11 || bytes[0] !== 1) return;
    const rows = Array.from(
      { length: 4 },
      (_, row) => (bytes[3 + row * 2] << 8) | bytes[4 + row * 2],
    ) as DrumPattern["rows"];
    const pattern = { rows, tempo: bytes[1] + 70, swing: bytes[2] + 50 };
    if (valid(pattern) && encodePattern(pattern) === code) return pattern;
  } catch {
    /* An invalid shared fragment leaves the default pattern intact. */
  }
}
