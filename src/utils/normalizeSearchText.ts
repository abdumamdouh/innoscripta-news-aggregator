/**
 * Fold text to a comparable key: case, Latin accents, Arabic letter variants and
 * punctuation all collapse away. Used for keyword matching and title dedupe.
 *
 * NFD splits accented Latin letters into base + combining mark so one strip handles
 * both scripts — the same pass removes Arabic harakat, which NFD also produces for
 * the composed hamza forms (أ → ا + U+0654).
 */
export function normalizeSearchText(value: string | undefined | null): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰ]/g, '') // Latin combining marks + harakat
    .replace(/ـ/g, '') // tatweel
    .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ → ا
    .replace(/ة/g, 'ه') // ة → ه
    .replace(/ى/g, 'ي') // ى → ي
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ') // punctuation, dashes, quotes → space
    .trim()
}
