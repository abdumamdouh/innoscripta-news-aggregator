export const appTheme = {
  appName: 'innoscripta News',
  defaultLanguage: 'en',
  /** 3x3 grid on desktop, 2-up tablet, 1-up mobile. */
  pageSize: 9,
  /**
   * How many articles to ask each source for. The merged, deduped window is what gets
   * paginated, so this is the depth of the feed rather than the size of a page — and every
   * story inside it is reachable, which per-source paging never managed.
   */
  sourceWindow: 50,
  debounceDelay: 300,
  storageKeys: {
    language: 'ina-language',
    theme: 'ina-theme',
    preferences: 'ina-preferences',
    bookmarks: 'ina-bookmarks',
    readingLists: 'ina-reading-lists',
    savedSearches: 'ina-saved-searches',
    directoryState: 'ina-directory-state',
    queryCache: 'ina-query-cache',
  },
} as const
