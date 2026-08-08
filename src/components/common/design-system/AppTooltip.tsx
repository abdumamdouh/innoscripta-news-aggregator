import type { ReactNode } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'

export interface AppTooltipProps {
  content: ReactNode
  children: ReactNode
}

/** Requires TooltipProvider from the App provider stack to be mounted above it. */
export function AppTooltip({ content, children }: AppTooltipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="z-50 max-w-64 rounded-lg bg-ink-900 px-3 py-2 text-sm text-paper-0 shadow-soft"
        >
          {content}
          <Tooltip.Arrow className="fill-ink-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export { TooltipProvider } from '@radix-ui/react-tooltip'
