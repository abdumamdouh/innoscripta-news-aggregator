/** Provider ISO string → the reader's locale, or `''` if the provider sent nothing usable. */
export function formatArticleDate(isoDate: string, language: string): string {
  const at = Date.parse(isoDate)
  if (Number.isNaN(at)) return ''
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(at)
}
