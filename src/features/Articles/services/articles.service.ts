import { appTheme } from '@/config/theme'
import { aggregate } from '@/core/sources/aggregator'
import type { AggregateResult } from '@/core/sources/aggregator'
import { SOURCES } from '@/core/sources/registry'
import type { ArticleQuery, NewsSource } from '@/core/sources/types'
import type { ArticlesState } from '@/features/Articles/types/articles.types'

/** Screen state → the one query shape the sources understand. Empty means "no filter". */
export function toArticleQuery(state: ArticlesState): ArticleQuery {
  return {
    q: state.q || undefined,
    from: state.from || undefined,
    to: state.to || undefined,
    categories: state.category ? [state.category] : undefined,
    authors: state.author ? [state.author] : undefined,
    sources: state.sources.length ? state.sources : undefined,
    page: state.page,
    pageSize: appTheme.pageSize,
  }
}

/**
 * Filtering happens here, once. The aggregator already applies every filter a source
 * cannot serve itself (`degrade`), capability by capability — so `useArticleList` re-sorts
 * and derives, and never filters a second time. A parallel client-side filter would
 * disagree with the providers that filtered server-side: NewsAPI folds a category into its
 * text expression and returns articles with no `category` field at all, so re-checking
 * `article.category` downstream would throw away the very results it asked for.
 */
export function fetchArticles(
  state: ArticlesState,
  signal?: AbortSignal,
  sources: NewsSource[] = SOURCES,
): Promise<AggregateResult> {
  return aggregate(toArticleQuery(state), sources, signal)
}
