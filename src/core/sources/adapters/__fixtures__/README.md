# Adapter fixtures — provenance

One captured response per provider, saved verbatim. Tests read these; nothing here hits
the network. The directory is listed in `.prettierignore` so `npm run format` cannot
reformat a captured body into something that is no longer what the provider sent.

| File            | Provenance                                                                                                                                                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `guardian.json` | Live call, verbatim — `GET https://content.guardianapis.com/search?api-key=test&show-fields=trailText,thumbnail,byline&page-size=10`, 2026-08-08. Guardian publishes `api-key=test` as a working key.                                                     |
| `bbc-rss.json`  | Live call, verbatim — `GET https://feeds.bbci.co.uk/news/rss.xml`, 2026-08-08. Keyless public feed. XML is a string under `xml` so the file stays `.json`.                                                                                                |
| `newsapi.json`  | Live call, verbatim — `GET https://newsapi.org/v2/everything?q=bitcoin&language=en`, 2026-08-08, using the demo key NewsAPI publishes in its own docs page for the "All articles about Bitcoin" live example. 100 articles as returned.                   |
| `nyt.json`      | A real Article Search response, verbatim, but **not captured by us**: no `NYT_KEY` exists in this environment and NYT rejects every keyless request. Taken from a public archive of a genuine call — `tjmtic/MAD-LiveData`, `Data/article_response.json`. |

## Why `nyt.json` is second-hand, and how to replace it

NYT is the one provider with no keyless and no published-demo route in: `articlesearch.json`
answers `{"fault":{"faultstring":"Failed to resolve API Key variable ..."}}` without a key and
`Invalid ApiKey` with a fake one. The archived body is a complete `articlesearch.json` payload
(`status`/`copyright`/`response.meta.hits`/`response.docs`) for 2020-08-31 — ten real articles,
real `nyt://article/...` uris, real `+0000` `pub_date`s, relative `multimedia[].url` paths, and
five docs the API returned with no multimedia at all. It is real API output that nobody wrote to
match this repo's code, which is the property that matters; it is simply older than a fresh call
would be, and it uses the pre-2025 array form of `multimedia` (the adapter reads both forms; the
object form is covered by a hand-mutated case in `adapters.test.ts`).

To replace it with a first-hand capture, register at the URL in `.env.example` and run:

```sh
curl -s "https://api.nytimes.com/svc/search/v2/articlesearch.json?q=technology&sort=newest&api-key=$NYT_KEY" \
  > src/core/sources/adapters/__fixtures__/nyt.json
npx vitest run src/core/sources
```

Save the body verbatim — no reformatting, no trimming of fields. The tests that name specific
values from this fixture are the ones under `describe('nyt adapter — provider quirks')`; the
per-field canonical assertions are written against the fixture's own contents and need no edit.

## Real data earns its keep

Swapping the two previously hand-authored fixtures for real ones immediately broke assertions
that the invented data had been shaped to satisfy — three of the hundred real NewsAPI articles
carry `"description": null`, which the invented five did not. `description` is therefore not
unconditionally non-empty; it is non-empty wherever the provider supplied something and `""`
where it did not, and the tests now assert exactly that split rather than the happy path.
