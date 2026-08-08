import { useCallback, useState } from 'react'

/**
 * What a reader can *do* to the feed. There is nothing to mutate on someone else's
 * newsroom, so retrying a failed fetch is the whole surface — busy flag included, because
 * the retry button has to say it is working.
 */
export function useArticleActions(refetch: () => Promise<unknown>) {
  const [isRetrying, setIsRetrying] = useState(false)

  const retry = useCallback(async () => {
    setIsRetrying(true)
    try {
      await refetch()
    } finally {
      setIsRetrying(false)
    }
  }, [refetch])

  return { retry, isRetrying }
}
