/**
 * The one taxonomy the app speaks, and each provider's translation of it.
 *
 * It used to be BBC's feed slugs re-exported from the registry, which made the whole app's
 * vocabulary a property of one adapter's RSS URLs — and quietly wrong: the Guardian files
 * entertainment under `culture` and the NYT calls business `Business Day`, so asking either
 * for `entertainment` or `business` matched nothing while both claimed to have filtered.
 *
 * A provider that has no equivalent for a category maps to `undefined`, which is the signal
 * to skip it rather than guess — asking the NYT for "uk" would return an unfiltered page.
 */
export const ARTICLE_CATEGORIES = [
  'general',
  'world',
  'uk',
  'business',
  'politics',
  'health',
  'science',
  'technology',
  'entertainment',
  'sport',
] as const

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]

export const isArticleCategory = (value: string): value is ArticleCategory =>
  (ARTICLE_CATEGORIES as readonly string[]).includes(value)

/** Guardian `section` ids. `general` is the whole front, so it constrains nothing. */
export const GUARDIAN_SECTIONS: Partial<Record<ArticleCategory, string>> = {
  world: 'world',
  uk: 'uk-news',
  business: 'business',
  politics: 'politics',
  health: 'society',
  science: 'science',
  technology: 'technology',
  entertainment: 'culture',
  sport: 'sport',
}

/** NYT `section_name` values, which are display names rather than slugs. */
export const NYT_SECTIONS: Partial<Record<ArticleCategory, string>> = {
  world: 'World',
  business: 'Business Day',
  politics: 'Politics',
  health: 'Health',
  science: 'Science',
  technology: 'Technology',
  entertainment: 'Arts',
  sport: 'Sports',
}

/**
 * NewsAPI has no taxonomy on `/everything` — only free text. A category is therefore a
 * search term, which is a weaker promise than the other three make, so the adapter declares
 * `category: false` and lets the aggregator filter what comes back.
 */
export const NEWSAPI_TERMS: Partial<Record<ArticleCategory, string>> = {
  world: 'world',
  uk: 'UK',
  business: 'business',
  politics: 'politics',
  health: 'health',
  science: 'science',
  technology: 'technology',
  entertainment: 'entertainment',
  sport: 'sport',
}
