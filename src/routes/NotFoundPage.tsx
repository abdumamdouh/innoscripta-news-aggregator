import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppButton } from '@/components/common/design-system'

export function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <section className="app-shell app-main text-center">
      <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">
        {t('route.notFound.title')}
      </h1>
      <p className="mt-2 text-ink-500">{t('route.notFound.body')}</p>
      <AppButton className="mt-6" onClick={() => void navigate('/')}>
        {t('route.notFound.back')}
      </AppButton>
    </section>
  )
}
