const Hero = require("@ulixee/hero").default;
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

// Load user agents from external file
function loadUserAgents() {
  try {
    const uaPath = path.join(__dirname, 'user-agents.json');
    if (fs.existsSync(uaPath)) {
      const agents = JSON.parse(fs.readFileSync(uaPath, 'utf-8'));
      console.log(`Loaded ${agents.length} user agents from file`);
      return agents;
    }
  } catch (e) {
    console.error('Failed to load user-agents.json:', e.message);
  }
  // fallback if file missing
  console.log('Using fallback user agents');
  return [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  ];
}

const USER_AGENTS = loadUserAgents();

// Cloudflare detection stuff
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

const CF_STRONG_INDICATORS = [
  "ray id: <code>",
  'class="ray-id">ray id:',
  "/cdn-cgi/challenge-platform/",
  "window._cf_chl_opt",
  "cloudflare.com?utm_source=challenge",
  "challenge-platform/h/b/orchestrate/chl_page",
];

const CF_HARD_CHALLENGE_INDICATORS = [
  "select all images",
  "click on the",
  "verify you are human",
  "hcaptcha",
  "recaptcha",
  "pick the",
  "challenge-image",
  "captcha-solver",
];

const CF_THRESHOLD_PERCENT = 0.2;

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

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
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

function detectHardChallenge(html) {
  const htmlLower = html.toLowerCase();
  for (const indicator of CF_HARD_CHALLENGE_INDICATORS) {
    if (htmlLower.includes(indicator.toLowerCase())) return true;
  }
  return false;
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

function extractTcgFromUrl(url, tcgList) {
  try {
    const pathParts = new URL(url).pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return null;
    const tcg = pathParts[1];
    return tcgList.find(t => t.toLowerCase() === tcg.toLowerCase()) || null;
  } catch (e) {
    return null;
  }
}

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

function selectXPathsForTcg(parsedConfig, detectedTcg, tcgList) {
  const tcgLower = detectedTcg?.toLowerCase();
  const byTitle = {};
  for (const entry of parsedConfig) {
    (byTitle[entry.title] ||= []).push(entry);
  }

  const selected = [];
  for (const [title, entries] of Object.entries(byTitle)) {
    let pick = null;
    if (tcgLower) {
      pick = entries.find(e => e.tcgTags.includes(tcgLower));
    }
    if (!pick) {
      pick = entries.find(e => e.isAny);
    }
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
      urlsPerSession: config.urlsPerSession || 15,
      hardChallengeCooldown: config.hardChallengeCooldown || 45000,
    };

    this.urls = parseUrls(config.urlsContent || "");
    this.emit = eventCallback || (() => {});
    this.hero = null;
    this.stopped = false;
    this.results = [];
    this.currentUserAgent = getRandomUserAgent();
    this.urlsInCurrentSession = 0;

    if (this.config.autoDetectMode) {
      this.tcgList = config.tcgList || [];
      this.parsedConfig = parseRawXPathConfig(config.rawXpathConfig || "", this.tcgList);
      this.xpathFields = [];
    } else {
      this.xpathFields = parseXPaths(config.xpathsContent || "");
      this.tcgList = [];
      this.parsedConfig = null;
    }
  }

  log(msg) {
    this.emit("log", { timestamp: new Date().toISOString(), message: msg });
  }

  // Bezier curve mouse movement
  async humanMove(hero, startX, startY, endX, endY) {
    const steps = 8 + Math.floor(Math.random() * 8);
    const points = [];
    
    const cp1x = startX + (endX - startX) * 0.3 + (Math.random() - 0.5) * 100;
    const cp1y = startY + (endY - startY) * 0.3 + (Math.random() - 0.5) * 100;
    const cp2x = startX + (endX - startX) * 0.7 + (Math.random() - 0.5) * 100;
    const cp2y = startY + (endY - startY) * 0.7 + (Math.random() - 0.5) * 100;
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const x = mt*mt*mt*startX + 3*mt*mt*t*cp1x + 3*mt*t*t*cp2x + t*t*t*endX;
      const y = mt*mt*mt*startY + 3*mt*mt*t*cp1y + 3*mt*t*t*cp2y + t*t*t*endY;
      points.push({ x: Math.round(x), y: Math.round(y) });
    }
    
    for (const point of points) {
      await hero.interact({ move: [point.x, point.y] });
      await sleep(20 + Math.random() * 40);
    }
  }

  async simulateHumanBehavior(hero, maxTime = 2000) {
    if (!hero) return;
    
    const startTime = Date.now();
    const timeLeft = () => maxTime - (Date.now() - startTime);
    
    try {
      const width = 1200;
      const height = 800;
      
      let currentX = 100 + Math.random() * (width - 200);
      let currentY = 100 + Math.random() * (height - 200);
      
      // One or two quick movements
      const movements = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < movements && timeLeft() > 500; i++) {
        const targetX = 50 + Math.random() * (width - 100);
        const targetY = 50 + Math.random() * (height - 100);
        await this.humanMove(hero, currentX, currentY, targetX, targetY);
        currentX = targetX;
        currentY = targetY;
      }
      
      if (timeLeft() > 300) {
        const scrollAmount = 50 + Math.floor(Math.random() * 200);
        await hero.interact({ scroll: { y: scrollAmount } });
        await sleep(Math.min(100, timeLeft()));
      }
      
    } catch (err) {
      // don't care
    }
  }

  async tryClickCfCheckbox(hero) {
    try {
      this.log("Looking for CF checkbox...");
      
      const selectors = [
        'iframe[src*="challenges.cloudflare.com"]',
        'iframe[src*="turnstile"]',
        '#turnstile-wrapper iframe',
        '.cf-turnstile iframe',
        'iframe[title*="challenge"]',
      ];
      
      for (const selector of selectors) {
        try {
          const iframe = await hero.document.querySelector(selector);
          if (iframe) {
            this.log(`Found CF iframe: ${selector}`);
            
            const rect = await iframe.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) {
              const clickX = rect.left + 30 + Math.random() * 10;
              const clickY = rect.top + rect.height / 2 + (Math.random() - 0.5) * 10;
              
              const startX = rect.left - 100 + Math.random() * 50;
              const startY = rect.top + Math.random() * rect.height;
              
              await this.humanMove(hero, startX, startY, clickX, clickY);
              await sleep(100 + Math.random() * 200);
              
              await hero.interact({ click: [clickX, clickY] });
              this.log("Clicked CF checkbox area");
              
              await sleep(3000 + Math.random() * 2000);
              return true;
            }
          }
        } catch (e) {
          // try next selector
        }
      }
      
      const checkboxPatterns = [
        '//input[@type="checkbox"]',
        '//*[contains(@class, "checkbox")]',
        '//*[contains(@id, "checkbox")]',
      ];
      
      for (const xpath of checkboxPatterns) {
        try {
          const result = await hero.document.evaluate(xpath, hero.document, null, 7, null);
          
          if (result.snapshotLength > 0) {
            const checkbox = result.snapshotItem(0);
            const rect = await checkbox.getBoundingClientRect();
            if (rect && rect.width > 0) {
              const clickX = rect.left + rect.width / 2;
              const clickY = rect.top + rect.height / 2;
              
              await hero.interact({ click: [clickX, clickY] });
              this.log("Clicked checkbox element");
              await sleep(3000 + Math.random() * 2000);
              return true;
            }
          }
        } catch (e) {
          // try next
        }
      }
      
      this.log("No CF checkbox found");
      return false;
    } catch (err) {
      this.log(`CF checkbox error: ${err.message}`);
      return false;
    }
  }

  async createHero() {
    this.currentUserAgent = getRandomUserAgent();
    this.urlsInCurrentSession = 0;
    
    this.log(`New session (showChrome: ${this.config.showChrome})`);
    this.log(`UA: ${this.currentUserAgent.substring(0, 60)}...`);
    
    this.hero = new Hero({ 
      showChrome: this.config.showChrome,
      userAgent: this.currentUserAgent,
    });
  }

  async rotateSession() {
    this.log("Rotating session...");
    await this.close();
    await sleep(2000 + Math.random() * 3000);
    await this.createHero();
    
    if (this.config.user && this.config.pass) {
      const ok = await this.loginToCardmarket();
      if (!ok) this.log("Re-login failed after rotation");
    }
  }

  async loginToCardmarket() {
    const { user, pass } = this.config;
    if (!user || !pass) return true;

    this.log(`Logging in as ${user}...`);

    try {
      await this.hero.goto("https://www.cardmarket.com/en/Magic", { timeoutMs: 60000 });
      await this.hero.waitForPaintingStable({ timeoutMs: 15000 }).catch(() => {});

      const loginBtn = await this.hero.document.evaluate(
        "//a[contains(@class, 'dropdown-toggle')]//span[contains(text(), 'Sign')]/..",
        this.hero.document,
        null,
        8,
        null
      );

      if (!loginBtn.singleNodeValue) {
        this.log("Couldnt find login button, might already be logged in?");
        return true;
      }

      await this.hero.click(loginBtn.singleNodeValue);
      await sleep(1000);

      const usernameField = await this.hero.document.evaluate(
        CARDMARKET_LOGIN_XPATHS.username,
        this.hero.document,
        null,
        8,
        null
      );
      if (!usernameField.singleNodeValue) {
        this.log("Username field not found");
        return false;
      }
      await this.hero.click(usernameField.singleNodeValue);
      
      // Human typing
      for (const char of user) {
        await this.hero.type(char);
        await sleep(50 + Math.random() * 100);
      }
      await sleep(300 + Math.random() * 200);

      const passwordField = await this.hero.document.evaluate(
        CARDMARKET_LOGIN_XPATHS.password,
        this.hero.document,
        null,
        8,
        null
      );
      if (!passwordField.singleNodeValue) {
        this.log("Password field not found");
        return false;
      }
      await this.hero.click(passwordField.singleNodeValue);
      
      for (const char of pass) {
        await this.hero.type(char);
        await sleep(30 + Math.random() * 80);
      }
      await sleep(500);

      const submitBtn = await this.hero.document.evaluate(
        CARDMARKET_LOGIN_XPATHS.submit,
        this.hero.document,
        null,
        8,
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

  async handleCloudflare(url, html, retryCount) {
    this.log("Handling CF challenge...");
    this.emit("status", { url, status: "cloudflare" });

    if (detectHardChallenge(html)) {
      this.log("Hard challenge detected (captcha). Backing off...");
      
      await this.close();
      this.log(`Cooling down for ${this.config.hardChallengeCooldown / 1000}s...`);
      await sleep(this.config.hardChallengeCooldown);
      
      await this.createHero();
      if (this.config.user && this.config.pass) {
        await this.loginToCardmarket();
      }
      
      return { shouldRetry: retryCount < this.config.maxRetries, hardChallenge: true };
    }

    const clicked = await this.tryClickCfCheckbox(this.hero);
    
    if (clicked) {
      await sleep(3000);
      const newHtml = await this.hero.document.documentElement.outerHTML;
      
      if (!detectCloudflare(newHtml).detected) {
        this.log("CF checkbox worked!");
        return { shouldRetry: false, passed: true, html: newHtml };
      }
      
      if (detectHardChallenge(newHtml)) {
        this.log("Checkbox led to hard challenge. Backing off...");
        await this.close();
        await sleep(this.config.hardChallengeCooldown);
        await this.createHero();
        if (this.config.user && this.config.pass) {
          await this.loginToCardmarket();
        }
        return { shouldRetry: retryCount < this.config.maxRetries, hardChallenge: true };
      }
    }

    this.log("Waiting 10s for CF...");
    await sleep(10000);

    let newHtml = await this.hero.document.documentElement.outerHTML;
    if (!detectCloudflare(newHtml).detected) {
      return { shouldRetry: false, passed: true, html: newHtml };
    }

    this.log(`Still blocked, waiting ${this.config.cloudflareWaitTime / 1000}s more`);
    await sleep(this.config.cloudflareWaitTime);

    newHtml = await this.hero.document.documentElement.outerHTML;
    if (!detectCloudflare(newHtml).detected) {
      return { shouldRetry: false, passed: true, html: newHtml };
    }

    this.log("CF failed, rotating session...");
    await this.rotateSession();
    
    return { shouldRetry: retryCount < this.config.maxRetries };
  }

  async scrapeUrl(url, retryCount = 0) {
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

        const cfResult = await this.handleCloudflare(url, html, retryCount);
        
        if (cfResult.passed) {
          html = cfResult.html;
          result.cloudflareDetected = false;
        } else if (cfResult.shouldRetry) {
          this.log(`Retry ${retryCount + 1}/${this.config.maxRetries}`);
          return this.scrapeUrl(url, retryCount + 1);
        } else {
          result.error = cfResult.hardChallenge ? "Hard CF challenge - backed off" : "CF challenge failed";
          return result;
        }
      }

      result.html = html;
      result.title = await this.hero.document.title;

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
    this.log(`Session rotation every ${this.config.urlsPerSession} URLs`);
    this.log(`Browser visible: ${this.config.showChrome}`);
    this.log(`User agents available: ${USER_AGENTS.length}`);

    this.emit("started", {
      totalUrls: validUrls.length,
      xpathCount: this.config.autoDetectMode ? "auto" : this.xpathFields.length,
    });

    await this.createHero();
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

        this.urlsInCurrentSession++;
        if (this.urlsInCurrentSession >= this.config.urlsPerSession) {
          this.log(`Rotating session after ${this.urlsInCurrentSession} URLs`);
          await this.rotateSession();
        }

        const url = validUrls[i];
        this.log(`\n[${i + 1}/${validUrls.length}] ${url}`);
        this.emit("progress", { current: i + 1, total: validUrls.length, url });

        if (cfStreak >= 3) {
          this.log(`${cfStreak} CF hits in a row, rotating and taking 2min break`);
          await this.rotateSession();
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
          const baseDelay = randomDelay(this.config.minDelay, this.config.maxDelay);
          const jitter = (Math.random() - 0.5) * 2000;
          const delay = Math.max(1000, baseDelay + jitter);
          this.log(`Waiting ${(delay / 1000).toFixed(1)}s`);
          
          // Do human stuff during the wait, not before
          const humanSimTime = Math.min(delay * 0.6, 3000); // use up to 60% of delay, max 3s
          const remainingWait = delay - humanSimTime;
          
          await this.simulateHumanBehavior(this.hero, humanSimTime);
          await sleep(remainingWait);
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
    const allTitles = new Set();
    for (const r of this.results) {
      for (const k of Object.keys(r.extractedData || {})) allTitles.add(k);
    }
    const fields = Array.from(allTitles);

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