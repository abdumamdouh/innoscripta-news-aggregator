import { describe, expect, it } from 'vitest'
import {
  ARTICLE_CATEGORIES,
  GUARDIAN_SECTIONS,
  NEWSAPI_TERMS,
  NYT_SECTIONS,
  isArticleCategory,
} from '@/core/sources/categories'
import { bbcNewsSource, resolveCategories } from '@/core/sources/adapters/bbc-rss'
import { newsapiSource } from '@/core/sources/adapters/newsapi'

describe('category taxonomy', () => {
  it('is owned by the core, not by one adapter’s URL map', () => {
    // It used to be BBC's feed slugs re-exported, which made a provider detail the app's
    // vocabulary — and silently wrong for the two providers with real taxonomies.
    expect(ARTICLE_CATEGORIES).toContain('business')
    expect(ARTICLE_CATEGORIES).toContain('entertainment')
    expect(new Set(ARTICLE_CATEGORIES).size).toBe(ARTICLE_CATEGORIES.length)
  })

  it('never sends our slug to a provider that uses a different word for it', () => {
    // The bug this replaces: asking the Guardian for `entertainment` or the NYT for
    // `business` matched nothing, while both declared they had filtered.
    expect(GUARDIAN_SECTIONS.entertainment).toBe('culture')
    expect(GUARDIAN_SECTIONS.uk).toBe('uk-news')
    expect(GUARDIAN_SECTIONS.health).toBe('society')
    expect(NYT_SECTIONS.business).toBe('Business Day')
    expect(NYT_SECTIONS.sport).toBe('Sports')
  })

  it('maps to undefined rather than guessing where a provider has no equivalent', () => {
    // NYT has no UK section; sending one anyway would return an unfiltered page.
    expect(NYT_SECTIONS.uk).toBeUndefined()
    expect(NYT_SECTIONS.general).toBeUndefined()
    expect(GUARDIAN_SECTIONS.general).toBeUndefined()
  })

  it('gives every mappable category a term for each provider that claims one', () => {
    for (const category of ARTICLE_CATEGORIES) {
      if (category === 'general') continue
      expect(NEWSAPI_TERMS[category], `newsapi term for ${category}`).toBeTruthy()
    }
  })

  it('recognises exactly the categories the app offers', () => {
    expect(isArticleCategory('business')).toBe(true)
    expect(isArticleCategory('Business Day')).toBe(false)
    expect(isArticleCategory('culture')).toBe(false)
  })

  it('keeps every BBC feed slug inside the shared taxonomy', () => {
    // BBC serves a category as a whole feed URL, so a slug it cannot resolve is dropped.
    for (const category of ARTICLE_CATEGORIES) {
      const resolved = resolveCategories({ categories: [category], page: 1, pageSize: 9 })
      expect(resolved.length, `bbc feed for ${category}`).toBeGreaterThan(0)
    }
  })
})

describe('capabilities are honest', () => {
  it('newsapi no longer claims filtering it performs with a search term', () => {
    // It declared category/author true while AND-ing both into free text, so the aggregator
    // skipped its own check and unrelated articles reached the grid.
    expect(newsapiSource.capabilities.category).toBe(false)
    expect(newsapiSource.capabilities.author).toBe(false)
  })

  it('bbc still declares the one filter it genuinely serves', () => {
    expect(bbcNewsSource.capabilities.category).toBe(true)
    expect(bbcNewsSource.capabilities.query).toBe(false)
  })
})
