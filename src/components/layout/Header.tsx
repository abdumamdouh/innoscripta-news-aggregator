import { lazy, Suspense, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen } from 'lucide-react'
import { AppIconButton } from '@/components/common/design-system'
import { Navigation } from '@/components/layout/Navigation'
import { LanguageSelect } from '@/components/layout/LanguageSelect'
// The markdown renderer and the README are a third of the bundle, for a panel most readers
// never open. Split out so the feed does not pay for it on first load.
const ProjectDrawer = lazy(() =>
  import('@/components/layout/ProjectDrawer').then((m) => ({ default: m.ProjectDrawer })),
)
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { PreferencesButton } from '@/features/Preferences'

export function Header() {
  const { t } = useTranslation()
  const [projectOpen, setProjectOpen] = useState(false)
  // The drawer is controlled, so there is no Radix Trigger for it to hand focus back to on
  // close. Without this a keyboard user lands at the top of the document instead of the
  // button they just used.
  const projectButton = useRef<HTMLButtonElement>(null)

  const restoreFocus = (event: Event) => {
    event.preventDefault()
    projectButton.current?.focus()
  }

  return (
    <header className="border-b border-ink-100 bg-paper-0 dark:border-ink-700 dark:bg-ink-900">
      <div className="app-shell flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center text-lg font-semibold text-ink-900 lg:min-h-0 dark:text-ink-100"
          aria-label={t('app.name')}
        >
          {t('app.name')}
        </Link>
        <Navigation />
        {/* Wraps rather than overflows: four controls no longer fit on one line at 375. */}
        <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
          <AppIconButton
            ref={projectButton}
            label={t('project.open')}
            onClick={() => setProjectOpen(true)}
          >
            <BookOpen className="size-5" aria-hidden />
          </AppIconButton>
          <PreferencesButton />
          <LanguageSelect />
          <ThemeToggle />
        </div>
      </div>
      {/* Only mounted once opened, so the split chunk is fetched on demand. */}
      {projectOpen && (
        <Suspense fallback={null}>
          <ProjectDrawer
            open={projectOpen}
            onOpenChange={setProjectOpen}
            onCloseAutoFocus={restoreFocus}
          />
        </Suspense>
      )}
    </header>
  )
}
