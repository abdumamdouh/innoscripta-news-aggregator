export const appTheme = {
  appName: 'innoscripta News',
  defaultLanguage: 'en',
  /** 3x3 grid on desktop, 2-up tablet, 1-up mobile. */
  pageSize: 9,
  debounceDelay: 300,
  storageKeys: {
    language: 'ina-language',
    theme: 'ina-theme',
    preferences: 'ina-preferences',
    bookmarks: 'ina-bookmarks',
    readingLists: 'ina-reading-lists',
    savedSearches: 'ina-saved-searches',
    feedCache: 'ina-feed-cache',
    directoryState: 'ina-directory-state',
  },
} as const
