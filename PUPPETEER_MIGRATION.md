# Puppeteer-Extra Migration Guide

If you decide to switch from Hero to Puppeteer-Extra + Stealth, here's exactly what would change.

---

## ⚠️ Important: This is Optional!

Only do this if:
- Hero is failing frequently (>20% CF rate)
- You've already tried profiles + longer delays
- You want to test an alternative approach

If Hero + profiles is working well, **stick with it!**

---

## 📦 Installation

```bash
npm install puppeteer-extra puppeteer-extra-plugin-stealth puppeteer
```

---

## 🔄 API Translation

### Creating Browser

**Hero:**
```javascript
const Hero = require("@ulixee/hero").default;

const hero = new Hero({
  showChrome: true,
  userAgent: '...',
  viewport: { width: 1920, height: 1080 },
  locale: 'en-US',
  timezoneId: 'America/New_York',
  userProfile: { storage: './profile-1' },
});
```

**Puppeteer-Extra:**
```javascript
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const browser = await puppeteer.launch({
  headless: false,  // Same as showChrome: true
  userDataDir: './profile-1',  // Same as userProfile

  args: [
    '--window-size=1920,1080',
    '--lang=en-US',
    '--disable-blink-features=AutomationControlled',
  ],
});

const page = await browser.newPage();
await page.setUserAgent('...');
await page.setViewport({ width: 1920, height: 1080 });
```

### Navigation

**Hero:**
```javascript
await hero.goto(url, { timeoutMs: 60000 });
await hero.waitForPaintingStable({ timeoutMs: 15000 });
```

**Puppeteer:**
```javascript
await page.goto(url, { timeout: 60000, waitUntil: 'networkidle2' });
```

### Getting HTML

**Hero:**
```javascript
const html = await hero.document.documentElement.outerHTML;
const title = await hero.document.title;
```

**Puppeteer:**
```javascript
const html = await page.content();
const title = await page.title();
```

### XPath Extraction

**Hero:**
```javascript
const result = await hero.document.evaluate(
  xpath,
  hero.document,
  null,
  XPathResult.FIRST_ORDERED_NODE_TYPE,
  null
);
const text = result?.singleNodeValue?.textContent?.trim();
```

**Puppeteer:**
```javascript
const [element] = await page.$x(xpath);
const text = element
  ? await page.evaluate(el => el.textContent?.trim(), element)
  : null;
```

### Mouse Movement

**Hero:**
```javascript
await hero.interact({ move: [x, y] });
await hero.interact({ click: [x, y] });
await hero.interact({ scroll: { y: amount } });
```

**Puppeteer:**
```javascript
await page.mouse.move(x, y);
await page.mouse.click(x, y);
await page.evaluate((amount) => window.scrollBy(0, amount), amount);
```

### Typing

**Hero:**
```javascript
await hero.type(char);
```

**Puppeteer:**
```javascript
await page.keyboard.type(char);
```

### Closing

**Hero:**
```javascript
await hero.close();
```

**Puppeteer:**
```javascript
await browser.close();
```

---

## 🎯 Full Puppeteer-Extra Scraper Example

Here's what your scraper would look like with Puppeteer-Extra:

```javascript
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { JSDOM } = require('jsdom');

// Enable all stealth patches
puppeteer.use(StealthPlugin());

class PuppeteerScraper {
  constructor(config, eventCallback) {
    this.config = config;
    this.emit = eventCallback || (() => {});
    this.browser = null;
    this.page = null;

    // Profile manager (same as before)
    this.profileManager = new ProfileManager();
    this.availableProfiles = this.profileManager.listProfiles();
  }

  async createBrowser() {
    // Select profile
    const randomProfile = this.availableProfiles[
      Math.floor(Math.random() * this.availableProfiles.length)
    ];
    this.currentProfilePath = randomProfile?.path || null;

    // Generate session parameters
    this.currentUserAgent = getRandomUserAgent();
    this.currentLocale = getRandomLocale();
    this.currentTimezone = getTimezoneForLocale(this.currentLocale);

    const viewportWidth = 1920 + Math.floor(Math.random() * 3) * 80;
    const viewportHeight = 1080 + Math.floor(Math.random() * 3) * 80;

    this.log(`New Puppeteer session`);
    this.log(`UA: ${this.currentUserAgent.substring(0, 60)}...`);
    this.log(`Viewport: ${viewportWidth}x${viewportHeight}`);
    this.log(`Locale: ${this.currentLocale}`);

    if (this.currentProfilePath) {
      this.log(`Profile: ${path.basename(this.currentProfilePath)} (REAL DATA)`);
    }

    // Launch browser with stealth
    this.browser = await puppeteer.launch({
      headless: false,  // Never use headless for Cloudflare

      // Use real Chrome (not Chromium)
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',

      // Persistent profile
      userDataDir: this.currentProfilePath,

      // Window size
      args: [
        `--window-size=${viewportWidth},${viewportHeight}`,
        `--lang=${this.currentLocale}`,
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote',
      ],
    });

    // Create page
    this.page = await this.browser.newPage();

    // Set viewport
    await this.page.setViewport({
      width: viewportWidth,
      height: viewportHeight
    });

    // Set user agent
    await this.page.setUserAgent(this.currentUserAgent);

    // Set extra headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': `${this.currentLocale},en;q=0.9`,
    });

    // Set timezone
    await this.page.emulateTimezone(this.currentTimezone);

    // Additional stealth: Override webdriver property (Stealth plugin does this, but extra insurance)
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
  }

  async humanMove(startX, startY, endX, endY) {
    const steps = 8 + Math.floor(Math.random() * 8);
    const points = [];

    // Bezier curve (same as before)
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

    for (let i = 0; i < points.length; i++) {
      const point = points[i];

      // Micro-jitter
      const jitterX = point.x + (Math.random() - 0.5) * 2;
      const jitterY = point.y + (Math.random() - 0.5) * 2;

      await this.page.mouse.move(jitterX, jitterY);

      // Variable speed
      const progress = i / points.length;
      const speedMultiplier = Math.sin(progress * Math.PI);
      const baseDelay = 30 + Math.random() * 40;
      const delay = baseDelay * (1 / (speedMultiplier + 0.5));

      await sleep(Math.min(delay, 100));
    }

    await sleep(50 + Math.random() * 150);
  }

  async simulateHumanBehavior(maxTime = 2000) {
    if (!this.page) return;

    const startTime = Date.now();
    const timeLeft = () => maxTime - (Date.now() - startTime);

    try {
      const viewport = await this.page.viewport();
      const width = viewport.width;
      const height = viewport.height;

      const centerX = width / 2;
      const centerY = height / 2;

      let currentX = centerX + (Math.random() - 0.5) * width * 0.6;
      let currentY = centerY + (Math.random() - 0.5) * height * 0.6;

      const actions = Math.floor(Math.random() * 3) + 2;

      for (let i = 0; i < actions && timeLeft() > 300; i++) {
        const action = Math.random();

        if (action < 0.4 && timeLeft() > 500) {
          // Mouse movement
          const targetX = centerX + (Math.random() - 0.5) * width * 0.6;
          const targetY = centerY + (Math.random() - 0.5) * height * 0.6;

          await this.humanMove(currentX, currentY, targetX, targetY);
          currentX = targetX;
          currentY = targetY;

        } else if (action < 0.7 && timeLeft() > 400) {
          // Scrolling
          const scrollType = Math.random();
          if (scrollType < 0.5) {
            await this.page.evaluate(() => window.scrollBy(0, 50 + Math.random() * 150));
          } else {
            await this.page.evaluate(() => window.scrollBy(0, 200 + Math.random() * 200));
            await sleep(Math.min(500 + Math.random() * 1000, timeLeft() * 0.3));
            await this.page.evaluate(() => window.scrollBy(0, -(50 + Math.random() * 100)));
          }

        } else if (timeLeft() > 800) {
          // Hover over elements
          try {
            const elements = await this.page.$$('a, button, div, p, h1, h2, h3');
            if (elements.length > 0) {
              const randomEl = elements[Math.floor(Math.random() * Math.min(elements.length, 20))];
              const box = await randomEl.boundingBox();

              if (box && box.width > 0 && box.height > 0) {
                const hoverX = box.x + box.width / 2;
                const hoverY = box.y + box.height / 2;

                if (hoverX > 0 && hoverX < width && hoverY > 0 && hoverY < height) {
                  await this.humanMove(currentX, currentY, hoverX, hoverY);
                  currentX = hoverX;
                  currentY = hoverY;
                  await sleep(Math.min(200 + Math.random() * 600, timeLeft() * 0.3));
                }
              }
            }
          } catch (e) {
            // Skip
          }
        }

        if (i < actions - 1 && timeLeft() > 300) {
          await sleep(Math.min(300 + Math.random() * 700, timeLeft() * 0.2));
        }
      }
    } catch (err) {
      // Don't care
    }
  }

  async scrapeUrl(url) {
    this.log(`Loading ${url}`);

    await this.page.goto(url, {
      timeout: this.config.pageLoadTimeout,
      waitUntil: 'networkidle2'
    });

    // Get HTML
    const html = await this.page.content();
    const title = await this.page.title();

    // Check for Cloudflare
    const cfCheck = detectCloudflare(html);
    if (cfCheck.detected) {
      this.log(`CF detected (${cfCheck.score}/${cfCheck.maxScore})`);
      // Handle Cloudflare (same logic as before)
    }

    // Extract data with XPath (using JSDOM like before)
    const extractedData = {};
    for (const field of this.xpathFields) {
      const value = extractXPath(html, field.xpath);
      extractedData[field.title] = value;
    }

    return { success: true, html, title, extractedData };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
```

---

## 🎯 Stealth Plugin Patches

The Stealth plugin automatically patches:

1. ✅ `navigator.webdriver` - Removes automation flag
2. ✅ `window.chrome` - Adds Chrome runtime object
3. ✅ `navigator.permissions` - Fixes permission queries
4. ✅ `navigator.plugins` - Adds realistic plugins (PDF viewer, etc.)
5. ✅ WebGL vendor/renderer - Consistent fingerprints
6. ✅ Canvas fingerprinting - Adds noise to prevent tracking
7. ✅ AudioContext fingerprinting - Consistent audio fingerprint
8. ✅ Font fingerprinting - Consistent font list
9. ✅ `navigator.languages` - Matches Accept-Language header
10. ✅ Media codecs - Matches real Chrome
11. ✅ `navigator.hardwareConcurrency` - Realistic CPU count
12. ✅ `screen` object - Realistic screen dimensions
13. ✅ Timezone - Consistent with locale
14. ✅ WebRTC leak prevention - No IP leaks
15. ✅ `iframe.contentWindow` - Proper iframe handling
16. ✅ User-Agent consistency - All properties match
17. ✅ HTTP/2 fingerprint - Matches real Chrome
18. ✅ TLS fingerprint - Matches real Chrome
19. ✅ CSS properties - Realistic CSS support
20. ✅ Much more...

---

## 📊 Effort vs. Benefit

### Effort to Switch
- ⏱️ **2-4 hours** to rewrite scraper
- 🧪 **1-2 hours** to test everything works
- 📚 **Learning curve** for Puppeteer API

### Potential Benefit
- ✅ **5-10% better** success rate (if Hero was already good)
- ✅ **20-30% better** success rate (if Hero was struggling)
- ✅ More community examples/support
- ✅ More plugins available

### My Recommendation
**Try Hero + profiles first!** If you're still getting >20% CF flags after:
- ✅ Persistent profiles
- ✅ 8-20 second delays
- ✅ Session warmup
- ✅ Residential proxies (if IP banned)

**THEN** consider switching to Puppeteer-Extra.

---

## 🎓 Testing Both Side-by-Side

If you want to test both without committing:

1. Keep your current Hero scraper
2. Create a new file `scraper-puppeteer.js` with Puppeteer version
3. Test both on same URLs
4. Compare CF detection rates
5. Choose the winner

---

## ⚡ Quick Decision Tree

```
Are you getting flagged >20%?
├─ NO → Stick with Hero (it's working!)
└─ YES → Have you tried profiles + longer delays?
    ├─ NO → Try those first (easier than rewriting)
    └─ YES → Try Puppeteer-Extra (worth the effort)
```

---

## 🔗 Resources

- **Puppeteer Docs:** https://pptr.dev/
- **Puppeteer-Extra:** https://github.com/berstend/puppeteer-extra
- **Stealth Plugin:** https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth

---

## Summary

Switching to Puppeteer-Extra means:
- ❌ Rewriting your scraper (different API)
- ✅ More mature anti-detection
- ✅ More community support
- ✅ Potentially better success rate

Only worth it if Hero + profiles isn't working well enough.
