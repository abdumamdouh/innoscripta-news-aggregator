# Adapter fixtures — provenance

One captured response per provider. Tests read these; nothing here hits the network.

| File            | Captured                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `guardian.json` | Live, verbatim — `GET https://content.guardianapis.com/search?api-key=test&show-fields=trailText,thumbnail,byline&page-size=10`, 2026-08-08. |
| `bbc-rss.json`  | Live, verbatim — `GET https://feeds.bbci.co.uk/news/rss.xml`, 2026-08-08. XML is a string under `xml` so the file stays `.json`.             |
| `newsapi.json`  | **Hand-authored** to the documented `/v2/everything` shape — no `NEWSAPI_KEY` was available in the build environment to make a live call.    |
| `nyt.json`      | **Hand-authored** to the documented `articlesearch.json` shape (2024+ object `multimedia`) — no `NYT_KEY` available.                         |

## Re-capturing the two hand-authored files

`newsapi.json` and `nyt.json` are **not** captured responses and do not satisfy the item's
"one real response per provider" requirement. Both providers reject keyless requests (`401`),
and no `NEWSAPI_KEY` / `NYT_KEY` exists in this environment — Guardian is real only because it
publishes a working `api-key=test`. Register at the URLs in `.env.example`, then, from the repo
root with the keys exported:

```sh
curl -s "https://newsapi.org/v2/everything?q=technology&pageSize=10&apiKey=$NEWSAPI_KEY" \
  > src/core/sources/adapters/__fixtures__/newsapi.json
curl -s "https://api.nytimes.com/svc/search/v2/articlesearch.json?q=technology&api-key=$NYT_KEY" \
  > src/core/sources/adapters/__fixtures__/nyt.json
npx vitest run src/core/sources
```

Save the bodies verbatim — no reformatting, no trimming of fields. The adapter tests are written
against the canonical `Article` shape, not against these files' contents, so they should pass
unchanged; anything they newly catch is a real mapping gap the invented fixture was hiding.
