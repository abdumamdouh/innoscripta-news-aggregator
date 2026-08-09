export type NameError = 'required' | 'duplicate'

/**
 * The one gate every named collection writes through: blank names cannot be picked and two
 * entries with the same name cannot be told apart. Case- and whitespace-insensitive, because
 * "Weekend" and "weekend " are the same thing to the reader who typed them.
 *
 * Lives here rather than in a feature file because reading lists and saved searches share the
 * rule — it is about names, not about either of them.
 */
export function nameError(
  items: readonly { id: string; name: string }[],
  name: string,
  exceptId?: string,
): NameError | undefined {
  const trimmed = name.trim()
  if (!trimmed) return 'required'
  const taken = items.some(
    (item) => item.id !== exceptId && item.name.toLowerCase() === trimmed.toLowerCase(),
  )

  return taken ? 'duplicate' : undefined
}
