import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/i18n'
import type { Article } from '@/core/sources/types'
import { ArticleCard } from '@/features/Articles/components/ArticleCard'
import en from '@/i18n/locales/en.json'

const article = (over: Partial<Article> = {}): Article => ({
  id: 'guardian:1',
  title: 'Mars rover lands safely',
  description: 'A long descent ends well.',
  url: 'https://example.test/mars',
  publishedAt: '2026-01-10T12:00:00.000Z',
  sourceId: 'guardian',
  sourceLabel: 'The Guardian',
  ...over,
})

const renderCard = (over: Partial<Article> = {}) =>
  render(
    <MemoryRouter>
      <ArticleCard article={article(over)} />
    </MemoryRouter>,
  )

describe('ArticleCard', () => {
  it('names the source in readable text, not colour alone', () => {
    renderCard()
    // The badge is tinted per source, but the a11y tree gets the words.
    expect(screen.getByText('The Guardian')).toBeInTheDocument()
    expect(screen.getByText(`${en['articles.source']}:`)).toBeInTheDocument()
  })

  it('renders the placeholder instead of a blank gap for an empty description', () => {
    renderCard({ description: '' })
    expect(screen.getByText(en['articles.noDescription'])).toBeInTheDocument()
  })

  it('renders the real description when there is one, and no placeholder', () => {
    renderCard()
    expect(screen.getByText('A long descent ends well.')).toBeInTheDocument()
    expect(screen.queryByText(en['articles.noDescription'])).not.toBeInTheDocument()
  })

  it('keeps the summary box the same height either way', () => {
    const { unmount } = renderCard()
    const withText = screen.getByText('A long descent ends well.').className
    unmount()
    renderCard({ description: '' })
    const withPlaceholder = screen.getByText(en['articles.noDescription']).className
    // Same min-height class on both, so an empty summary cannot ragged the grid.
    expect(withText).toContain('min-h-15')
    expect(withPlaceholder).toContain('min-h-15')
  })

  it('links to the article details route and dates the story machine-readably', () => {
    renderCard()
    expect(screen.getByRole('link', { name: 'Mars rover lands safely' })).toHaveAttribute(
      'href',
      `/articles/${encodeURIComponent('guardian:1')}`,
    )
    expect(screen.getByText(/2026/)).toHaveAttribute('dateTime', '2026-01-10T12:00:00.000Z')
  })
})
