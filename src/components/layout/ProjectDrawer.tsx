import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTranslation } from 'react-i18next'
import { AppModal } from '@/components/common/design-system'
import readme from '../../../README.md?raw'

interface ProjectDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus?: (event: Event) => void
}

/**
 * The README, rendered in the app. It is the same file the repo ships, imported with `?raw`
 * so the two cannot drift — there is no second copy of the walkthrough to keep in sync.
 *
 * The title is already the drawer's heading, so the document's own H1 is dropped and its
 * H2s render as H3s to keep the outline below it rather than beside it.
 */
export function ProjectDrawer({ open, onOpenChange, onCloseAutoFocus }: ProjectDrawerProps) {
  const { t } = useTranslation()
  const body = readme.replace(/^#\s.*\n/, '')

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      variant="drawer"
      title={t('project.title')}
      description={t('project.description')}
      className="w-[min(100%-3rem,44rem)]"
    >
      {/*
        min-w-0 is what lets this shrink inside the drawer's flex column — without it the
        widest table sets the floor and the whole page scrolls sideways at 375. The tables
        and command blocks then scroll within themselves rather than pushing the layout.
      */}
      <div className="prose prose-sm min-w-0 max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-accent-600 prose-pre:overflow-x-auto prose-table:block prose-table:overflow-x-auto">
        <Markdown remarkPlugins={[remarkGfm]} components={{ h2: 'h3', h3: 'h4' }}>
          {body}
        </Markdown>
      </div>
    </AppModal>
  )
}
