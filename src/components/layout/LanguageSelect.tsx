import { useTranslation } from 'react-i18next'
import { AppSelect } from '@/components/common/design-system'
import { SUPPORTED_LANGUAGES } from '@/i18n'

export function LanguageSelect() {
  const { t, i18n } = useTranslation()

  return (
    <AppSelect
      label={t('language.label')}
      hideLabel
      value={i18n.language}
      onValueChange={(value) => void i18n.changeLanguage(value)}
      options={SUPPORTED_LANGUAGES.map((code) => ({ value: code, label: t(`language.${code}`) }))}
      className="min-w-32"
    />
  )
}
