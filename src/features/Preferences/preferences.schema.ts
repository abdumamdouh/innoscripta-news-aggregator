import type { TFunction } from 'i18next'
import { ValidationError, array, object, string } from 'yup'
import type {
  Preferences,
  PreferencesErrorField,
  PreferencesErrors,
} from '@/features/Preferences/types/preferences.types'

/** Long enough for "Dr. Anne-Marie O'Sullivan-Featherstonehaugh", short enough to be a name. */
export const AUTHOR_MAX_LENGTH = 80

/**
 * A factory, not a module-level schema, because the messages are the reader's language:
 * built with the live `t` so switching locale rebuilds them instead of freezing English
 * at import time.
 */
export const createPreferencesSchema = (t: TFunction) =>
  object({
    // Categories and authors may legitimately be empty — that reads as "any". Sources
    // cannot: a feed with no source to query has nothing to show.
    sources: array(string().required()).min(1, t('preferences.errors.sourcesRequired')),
    categories: array(string().required()).defined(),
    authors: array(
      string()
        .required()
        .max(AUTHOR_MAX_LENGTH, t('preferences.errors.authorTooLong', { max: AUTHOR_MAX_LENGTH })),
    ).defined(),
  })

/**
 * Yup paths are `sources` and `authors[2]` — the field is whatever precedes the index.
 * `categories` is absent on purpose: it is only `.defined()`, so it has no failure mode.
 */
const fieldOf = (path: string | undefined): PreferencesErrorField | undefined => {
  const field = path?.split(/[.[]/)[0]
  return field === 'sources' || field === 'authors' ? field : undefined
}

/**
 * Every problem at once (`abortEarly: false`), collapsed to one message per field so the
 * form can put it next to the control that caused it. First message per field wins —
 * three "too long" authors are one fix, not three.
 */
export function validatePreferences(values: Preferences, t: TFunction): PreferencesErrors {
  try {
    createPreferencesSchema(t).validateSync(values, { abortEarly: false })
    return {}
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error
    const errors: PreferencesErrors = {}
    // `inner` is empty when yup aborts on the first failure; the error itself is then it.
    for (const issue of error.inner.length ? error.inner : [error]) {
      const field = fieldOf(issue.path)
      if (field && !errors[field]) errors[field] = issue.message
    }

    return errors
  }
}
