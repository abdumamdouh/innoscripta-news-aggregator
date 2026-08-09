import { useNavigate, useRouteError } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppButton } from '@/components/common/design-system'

/** Thrown render/loader errors — distinct from a 404, which is a matched `*` route. */
export function RouteErrorPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const error = useRouteError()

  return (
    <section className="app-shell app-main text-center">
      <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-100">
        {t('route.error.title')}
      </h1>
      <p className="mt-2 text-ink-500">{t('route.error.body')}</p>
      {import.meta.env.DEV && error instanceof Error && (
        <pre className="mt-4 overflow-x-auto text-start text-sm text-ink-500">{error.message}</pre>
      )}
      <AppButton className="mt-6" onClick={() => void navigate('/')}>
        {t('route.notFound.back')}
      </AppButton>
    </section>
  )
}
