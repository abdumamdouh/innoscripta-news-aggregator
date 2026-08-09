import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AppButton,
  AppCheckbox,
  AppInput,
  AppModal,
  AppTooltip,
} from '@/components/common/design-system'
import { ARTICLE_CATEGORIES } from '@/core/sources/categories'
import { SOURCES } from '@/core/sources/registry'
import { usePreferences } from '@/features/Preferences/hooks/usePreferences'
import { validatePreferences } from '@/features/Preferences/preferences.schema'
import type { PreferencesErrors } from '@/features/Preferences/types/preferences.types'
import {
  formatAuthors,
  parseAuthors,
  toggleValue,
  writePreferences,
} from '@/features/Preferences/utils/preferences'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-danger-600 dark:text-danger-300">
      {message}
    </p>
  )
}

/**
 * Mounted only while the dialog is open (Radix unmounts the portal), which is what makes
 * seeding the draft from stored state in `useState` correct — reopening re-reads.
 */
function PreferencesForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const stored = usePreferences()
  const [sources, setSources] = useState(stored.sources)
  const [categories, setCategories] = useState(stored.categories)
  const [authorsText, setAuthorsText] = useState(formatAuthors(stored.authors))
  const [errors, setErrors] = useState<PreferencesErrors>({})

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const values = { sources, categories, authors: parseAuthors(authorsText) }
    const found = validatePreferences(values, t)
    setErrors(found)
    if (Object.keys(found).length) return
    writePreferences(values)
    onDone()
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={submit} noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-ink-700 dark:text-ink-100">
          {t('preferences.sources')}
        </legend>
        <div className="flex flex-col gap-2">
          {SOURCES.map((source) => {
            const box = (
              <AppCheckbox
                label={source.label}
                checked={sources.includes(source.id)}
                disabled={!source.available}
                onCheckedChange={() => setSources((current) => toggleValue(current, source.id))}
              />
            )
            // A source nobody can pick still has to say why — the reason is the tooltip.
            return source.available ? (
              <div key={source.id}>{box}</div>
            ) : (
              <AppTooltip key={source.id} content={t(`sources.unavailableReason.${source.id}`)}>
                <div className="w-fit">{box}</div>
              </AppTooltip>
            )
          })}
        </div>
        <FieldError message={errors.sources} />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-ink-700 dark:text-ink-100">
          {t('preferences.categories')}
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {ARTICLE_CATEGORIES.map((category) => (
            <AppCheckbox
              key={category}
              label={t(`articles.category.${category}`)}
              checked={categories.includes(category)}
              onCheckedChange={() => setCategories((current) => toggleValue(current, category))}
            />
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <AppInput
          label={t('preferences.authors.label')}
          placeholder={t('preferences.authors.placeholder')}
          value={authorsText}
          error={errors.authors}
          onChange={(event) => setAuthorsText(event.target.value)}
        />
        <p className="text-sm text-ink-500">{t('preferences.authors.hint')}</p>
      </div>

      <div className="flex justify-end gap-2">
        <AppButton type="button" variant="secondary" onClick={onDone}>
          {t('preferences.cancel')}
        </AppButton>
        <AppButton type="submit">{t('preferences.save')}</AppButton>
      </div>
    </form>
  )
}

export interface PreferencesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PreferencesModal({ open, onOpenChange }: PreferencesModalProps) {
  const { t } = useTranslation()

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('preferences.title')}
      description={t('preferences.description')}
    >
      <PreferencesForm onDone={() => onOpenChange(false)} />
    </AppModal>
  )
}
