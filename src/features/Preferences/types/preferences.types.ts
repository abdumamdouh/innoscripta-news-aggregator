/**
 * What a reader wants their news to be made of. Empty in any dimension reads as
 * "no preference there" — item 8's feed widens rather than returning nothing.
 */
export interface Preferences {
  sources: string[]
  categories: string[]
  authors: string[]
}

/** Categories are unconstrained — any subset is valid, including none — so they cannot fail. */
export type PreferencesErrorField = Exclude<keyof Preferences, 'categories'>

export type PreferencesErrors = Partial<Record<PreferencesErrorField, string>>
