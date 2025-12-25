# CMScrape 2

## WARNING
**THIS PROJECT ISN'T FULLY COOKED YET, MISSING ONE OR TWO COMMITS AND A RELEASE**

Scrapes card prices from CardMarket. Handles Cloudflare, exports to CSV.

## Usage
0. Get latest release, install it
1. Paste URLs (one per line), or load file
2. Pick TCG or leave on auto-detect
3. Start
4. Results end up in the folder you pick (default `./scraped_results/`)

Login fields are optional, only if you need authenticated stuff.
I suggest using the default settings, it is slow, but it doesn't get stopped.

### Cloudflare

It waits automatically when blocked. If you keep getting blocked, bump up the delays. Three blocks in a row = 2 min cooldown.

---

## Dev stuff

### Run from source

```bash
npm install
npm start
```

If you get an error with better sqlite3, just do : 
```bash
npm rebuild better-sqlite3
```

### XPath config

Edit `RAW_XPATH_CONFIG` in index.html. Format:

```
Field Name|/xpath/here|tags
```

Tags:
- TCG name (Pokemon, Magic...) = only for that TCG
- `any` = fallback
- `sum` = totals in the banner

### Contributing

I don't scrape that often so this repo doesn't get much love. Fork it, send merge requests, whatever. I'll merge anything reasonable after a quick test.

New TCG layouts, xpath fixes, UI stuff - all welcome.