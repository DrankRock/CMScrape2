const Hero = require("@ulixee/hero").default;
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

// Cloudflare detection stuff. These strings show up on challenge pages.
// The threshold is pretty generous because we'd rather wait than miss one.
const CF_INDICATORS = [
  "<title>just a moment...</title>",
  '<meta name="robots" content="noindex,nofollow"',
  '<meta http-equiv="refresh" content="390"',
  'class="loading-spinner"',
  'class="lds-ring"',
  'class="main-wrapper"',
  'class="challenge-',
  'id="challenge-error-text"',
  'id="challenge-success-text"',
  "verifying you are human",
  "this may take a few seconds",
  "needs to review the security of your connection",
  "enable javascript and cookies to continue",
  "waiting for",
  "verification successful",
  "performance & security by",
  "ray id:",
  "/cdn-cgi/challenge-platform/",
  "/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page",
  "cloudflareinsights.com/beacon",
  "cf_chl_opt",
  "cf-ray",
  "cf_chl_",
  "chl_page",
  "turnstile",
  "challenges.cloudflare.com",
  "window._cf_chl_opt",
  "coguhash",
  "coguquery",
  'div class="lds-ring"><div></div><div></div><div></div><div></div></div>',
  "background-image:url(data:image/svg+xml;base64,",
  "@keyframes lds-ring{",
  "animation:lds-ring",
  'role="contentinfo"',
  '<a rel="noopener noreferrer" href="https://www.cloudflare.com?utm_source=challenge',
];

// These are dead giveaways, worth more points
const CF_STRONG_INDICATORS = [
  "ray id: <code>",
  'class="ray-id">ray id:',
  "/cdn-cgi/challenge-platform/",
  "window._cf_chl_opt",
  "cloudflare.com?utm_source=challenge",
  "challenge-platform/h/b/orchestrate/chl_page",
];

const CF_THRESHOLD_PERCENT = 0.2;

// Login form xpaths for cardmarket
const CARDMARKET_LOGIN_XPATHS = {
  username: "/html/body/header/nav[1]/ul/li/div/form/div[1]/div/input",
  password: "/html/body/header/nav[1]/ul/li/div/form/div[2]/div/input",
  submit: "/html/body/header/nav[1]/ul/li/div/form/input[3]",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return min + Math.random() * (max - min);
}

function detectCloudflare(html) {
  const htmlLower = html.toLowerCase();
  let score = 0;

  for (const indicator of CF_INDICATORS) {
    if (htmlLower.includes(indicator.toLowerCase())) score++;
  }
  for (const indicator of CF_STRONG_INDICATORS) {
    if (htmlLower.includes(indicator.toLowerCase())) score += 2;
  }

  const maxScore = CF_INDICATORS.length + CF_STRONG_INDICATORS.length * 2;
  const threshold = Math.floor(maxScore * CF_THRESHOLD_PERCENT);

  return { detected: score >= threshold, score, maxScore, threshold };
}

function extractXPath(html, xpath) {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const result = doc.evaluate(xpath, doc, null, dom.window.XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return result?.singleNodeValue?.textContent?.trim() || null;
  } catch (e) {
    return null;
  }
}

function sanitizeFilename(url) {
  return url.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 100);
}

function parseUrls(content) {
  return content.split("\n").map(u => u.trim()).filter(u => u && !u.startsWith("#"));
}

function parseXPaths(content) {
  return content
    .split("\n")
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"))
    .map(line => {
      const parts = line.split("|");
      if (parts.length >= 2) {
        return { title: parts[0].trim(), xpath: parts.slice(1).join("|").trim() };
      }
      return { title: line, xpath: line };
    });
}

// Pulls the TCG name out of cardmarket URLs
// e.g. /fr/Pokemon/Products/... -> "Pokemon"
function extractTcgFromUrl(url, tcgList) {
  try {
    const pathParts = new URL(url).pathname.split('/').filter(Boolean);
    // [0] is language (fr, en, de...), [1] is the TCG
    if (pathParts.length < 2) return null;
    
    const tcg = pathParts[1];
    return tcgList.find(t => t.toLowerCase() === tcg.toLowerCase()) || null;
  } catch (e) {
    return null;
  }
}

// Parse the raw config into something we can work with
function parseRawXPathConfig(rawConfig, tcgList) {
  const tcgListLower = tcgList.map(t => t.toLowerCase());
  const entries = [];

  for (const line of rawConfig.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split('|').map(s => s.trim());
    if (parts.length < 2) continue;

    const [title, xpath] = parts;
    const tagsRaw = parts[2] || '';
    const tags = tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

    entries.push({
      title,
      xpath,
      tcgTags: tags.filter(t => tcgListLower.includes(t)),
      isSum: tags.includes('sum'),
      isAny: tags.includes('any'),
    });
  }

  return entries;
}

// Pick the right xpaths for a given TCG.
// Priority: specific TCG match > "any" fallback > universal (no tags)
function selectXPathsForTcg(parsedConfig, detectedTcg, tcgList) {
  const tcgLower = detectedTcg?.toLowerCase();

  // group by field name
  const byTitle = {};
  for (const entry of parsedConfig) {
    (byTitle[entry.title] ||= []).push(entry);
  }

  const selected = [];
  for (const [title, entries] of Object.entries(byTitle)) {
    let pick = null;

    // try specific match first
    if (tcgLower) {
      pick = entries.find(e => e.tcgTags.includes(tcgLower));
    }
    // then "any"
    if (!pick) {
      pick = entries.find(e => e.isAny);
    }
    // then universal
    if (!pick) {
      pick = entries.find(e => e.tcgTags.length === 0 && !e.isAny);
    }

    if (pick) {
      selected.push({ title: pick.title, xpath: pick.xpath, isSum: pick.isSum });
    }
  }

  return selected;
}


class Scraper {
  constructor(config, eventCallback) {
    this.config = {
      outputDir: config.outputDir || "./scraped_results",
      cloudflareWaitTime: config.cloudflareWaitTime || 30000,
      minDelay: config.minDelay || 3000,
      maxDelay: config.maxDelay || 8000,
      pageLoadTimeout: config.pageLoadTimeout || 60000,
      maxRetries: config.maxRetries || 3,
      showChrome: config.showChrome !== false,
      user: config.user || null,
      pass: config.pass || null,
      autoDetectMode: config.autoDetectMode || false,
    };

    this.urls = parseUrls(config.urlsContent || "");
    this.emit = eventCallback || (() => {});
    this.hero = null;
    this.stopped = false;
    this.results = [];

    if (this.config.autoDetectMode) {
      this.tcgList = config.tcgList || [];
      this.parsedConfig = parseRawXPathConfig(config.rawXpathConfig || "", this.tcgList);
      this.xpathFields = []; // set per-url
    } else {
      this.xpathFields = parseXPaths(config.xpathsContent || "");
      this.tcgList = [];
      this.parsedConfig = null;
    }
  }

  log(msg) {
    this.emit("log", { timestamp: new Date().toISOString(), message: msg });
  }

  async loginToCardmarket() {
    const { user, pass } = this.config;
    if (!user || !pass) return true;

    this.log(`Logging in as ${user}...`);

    try {
      await this.hero.goto("https://www.cardmarket.com/en/Magic", { timeoutMs: 60000 });
      await this.hero.waitForPaintingStable({ timeoutMs: 15000 }).catch(() => {});

      let html = await this.hero.document.documentElement.outerHTML;
      if (detectCloudflare(html).detected) {
        this.log("CF detected on login page, waiting...");
        await sleep(15000);
        html = await this.hero.document.documentElement.outerHTML;
        if (detectCloudflare(html).detected) {
          this.log("Still blocked on login, skipping login");
          return false;
        }
      }

      const usernameInput = await this.hero.document.evaluate(
        CARDMARKET_LOGIN_XPATHS.username,
        this.hero.document,
        null,
        0,
        null
      );
      if (!usernameInput.singleNodeValue) {
        this.log("Can't find username field");
        return false;
      }

      await this.hero.click(usernameInput.singleNodeValue);
      await this.hero.type(user);
      await sleep(500);

      const passwordInput = await this.hero.document.evaluate(
        CARDMARKET_LOGIN_XPATHS.password,
        this.hero.document,
        null,
        0,
        null
      );
      if (!passwordInput.singleNodeValue) {
        this.log("Can't find password field");
        return false;
      }

      await this.hero.click(passwordInput.singleNodeValue);
      await this.hero.type(pass);
      await sleep(500);

      const submitBtn = await this.hero.document.evaluate(
        CARDMARKET_LOGIN_XPATHS.submit,
        this.hero.document,
        null,
        0,
        null
      );
      if (!submitBtn.singleNodeValue) {
        this.log("Can't find submit button");
        return false;
      }
      await this.hero.click(submitBtn.singleNodeValue);
      await this.hero.waitForPaintingStable({ timeoutMs: 15000 }).catch(() => {});
      await sleep(3000);

      this.log("Login done");
      return true;
    } catch (err) {
      this.log(`Login failed: ${err.message}`);
      return false;
    }
  }

  async scrapeUrl(url, retryCount = 0) {
    // figure out which xpaths to use
    let xpathFields = this.xpathFields;
    let detectedTcg = null;

    if (this.config.autoDetectMode && this.parsedConfig) {
      detectedTcg = extractTcgFromUrl(url, this.tcgList);
      xpathFields = selectXPathsForTcg(this.parsedConfig, detectedTcg, this.tcgList);
      this.log(detectedTcg 
        ? `TCG: ${detectedTcg} (${xpathFields.length} xpaths)`
        : `Unknown TCG, using ${xpathFields.length} fallback xpaths`
      );
    }

    const result = {
      url,
      success: false,
      extractedData: {},
      timestamp: new Date().toISOString(),
      cloudflareDetected: false,
      detectedTcg,
    };

    if (!url.includes("cardmarket.com")) {
      result.error = "Not a CardMarket URL";
      this.log(`Skipping: ${url}`);
      return result;
    }

    try {
      this.log(`Loading ${url}`);
      this.emit("status", { url, status: "loading" });

      await this.hero.goto(url, { timeoutMs: this.config.pageLoadTimeout });
      await this.hero.waitForPaintingStable({ timeoutMs: 15000 }).catch(() => {});

      let html = await this.hero.document.documentElement.outerHTML;
      const cfCheck = detectCloudflare(html);

      if (cfCheck.detected) {
        result.cloudflareDetected = true;
        this.log(`CF detected (${cfCheck.score}/${cfCheck.maxScore})`);
        this.emit("status", { url, status: "cloudflare" });

        this.log("Waiting 10s...");
        await sleep(10000);

        html = await this.hero.document.documentElement.outerHTML;
        if (detectCloudflare(html).detected) {
          this.log(`Still blocked, waiting ${this.config.cloudflareWaitTime / 1000}s more`);
          await sleep(this.config.cloudflareWaitTime);

          if (retryCount < this.config.maxRetries) {
            this.log(`Retry ${retryCount + 1}/${this.config.maxRetries}`);
            return this.scrapeUrl(url, retryCount + 1);
          }
          result.error = "CF challenge failed";
          return result;
        }
        result.cloudflareDetected = false;
      }

      result.html = html;
      result.title = await this.hero.document.title;

      // extract all the fields
      this.log(`Extracting ${xpathFields.length} field(s)`);
      for (const field of xpathFields) {
        const val = extractXPath(html, field.xpath);
        result.extractedData[field.title] = val;
        this.log(`  ${field.title}: ${val || "(empty)"}`);
      }

      result.success = true;
      this.log(`Done`);
      this.emit("status", { url, status: "success" });

    } catch (err) {
      result.error = err.message;
      this.log(`Failed: ${err.message}`);
      this.emit("status", { url, status: "error", error: err.message });

      if (retryCount < this.config.maxRetries) {
        this.log(`Retry ${retryCount + 1}/${this.config.maxRetries}`);
        await sleep(5000);
        return this.scrapeUrl(url, retryCount + 1);
      }
    }

    return result;
  }

  async run() {
    if (!this.urls.length) throw new Error("No URLs");
    if (!this.config.autoDetectMode && !this.xpathFields.length) {
      throw new Error("No XPaths defined");
    }

    const validUrls = this.urls.filter(u => u.includes("cardmarket.com"));
    const skipped = this.urls.length - validUrls.length;
    if (skipped) this.log(`Skipping ${skipped} non-CardMarket URLs`);

    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    this.log(`Scraping ${validUrls.length} URLs`);
    this.log(this.config.autoDetectMode ? `Mode: auto-detect` : `XPaths: ${this.xpathFields.length}`);
    this.log(`Output: ${this.config.outputDir}`);

    this.emit("started", {
      totalUrls: validUrls.length,
      xpathCount: this.config.autoDetectMode ? "auto" : this.xpathFields.length,
    });

    this.hero = new Hero({ showChrome: this.config.showChrome });
    let cfStreak = 0;

    try {
      if (this.config.user && this.config.pass) {
        const ok = await this.loginToCardmarket();
        if (!ok) this.log("Login failed, continuing anyway...");
      }

      for (let i = 0; i < validUrls.length; i++) {
        if (this.stopped) {
          this.log("Stopped by user");
          break;
        }

        const url = validUrls[i];
        this.log(`\n[${i + 1}/${validUrls.length}] ${url}`);
        this.emit("progress", { current: i + 1, total: validUrls.length, url });

        // take a break if CF keeps blocking us
        if (cfStreak >= 3) {
          this.log(`${cfStreak} CF hits in a row, taking 2min break`);
          await sleep(120000);
          cfStreak = 0;
        }

        const result = await this.scrapeUrl(url);
        this.results.push(result);
        cfStreak = result.cloudflareDetected ? cfStreak + 1 : 0;

        if (result.success && result.html) {
          const filename = path.join(this.config.outputDir, `${sanitizeFilename(url)}.html`);
          fs.writeFileSync(filename, result.html);
        }

        this.emit("result", result);

        if (i < validUrls.length - 1 && !this.stopped) {
          const delay = randomDelay(this.config.minDelay, this.config.maxDelay);
          this.log(`Waiting ${(delay / 1000).toFixed(1)}s`);
          await sleep(delay);
        }
      }
    } finally {
      await this.close();
    }

    this.saveResults();

    const summary = {
      totalUrls: validUrls.length,
      successful: this.results.filter(r => r.success).length,
      failed: this.results.filter(r => !r.success).length,
      cloudflareBlocked: this.results.filter(r => r.cloudflareDetected && !r.success).length,
    };

    this.emit("completed", summary);
    this.log(`\nDone: ${summary.successful}/${summary.totalUrls} ok`);

    return this.results;
  }

  saveResults() {
    // collect all field names across results
    const allTitles = new Set();
    for (const r of this.results) {
      for (const k of Object.keys(r.extractedData || {})) allTitles.add(k);
    }
    const fields = Array.from(allTitles);

    // csv
    const csvLines = [["url", "detected_tcg", ...fields].join(",")];
    for (const r of this.results) {
      const row = [
        `"${r.url.replace(/"/g, '""')}"`,
        `"${(r.detectedTcg || '').replace(/"/g, '""')}"`,
        ...fields.map(f => `"${(r.extractedData[f] || '').replace(/"/g, '""')}"`)
      ];
      csvLines.push(row.join(","));
    }
    const csvPath = path.join(this.config.outputDir, "extracted_data.csv");
    fs.writeFileSync(csvPath, csvLines.join("\n"));

    // json
    const summary = {
      timestamp: new Date().toISOString(),
      totalUrls: this.results.length,
      successful: this.results.filter(r => r.success).length,
      failed: this.results.filter(r => !r.success).length,
      autoDetectMode: this.config.autoDetectMode,
      results: this.results.map(({ url, success, title, error, timestamp, cloudflareDetected, extractedData, detectedTcg }) => ({
        url, success, title, error, timestamp, cloudflareDetected, detectedTcg, extractedData,
      })),
    };
    fs.writeFileSync(path.join(this.config.outputDir, "summary.json"), JSON.stringify(summary, null, 2));

    this.log(`Saved: ${csvPath}`);
    this.log(`Saved: ${path.join(this.config.outputDir, "summary.json")}`);
  }

  async stop() {
    this.stopped = true;
    await this.close();
  }

  async close() {
    if (this.hero) {
      try { await this.hero.close(); } catch (e) { /* whatever */ }
      this.hero = null;
    }
  }
}

module.exports = { Scraper, parseUrls, parseXPaths, extractTcgFromUrl, selectXPathsForTcg };