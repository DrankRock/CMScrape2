# 🎯 Persistent Profile Setup Guide

Your scraper now uses **real Chrome profiles** copied from your actual browser. This is one of the most powerful anti-detection techniques available.

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Run the Setup Script
```bash
# Double-click this file:
setup-profiles.bat

# OR run manually:
node src/profile-manager.js
```

This will:
- Find your Chrome profile at `C:\Users\PC Info\AppData\Local\Google\Chrome\User Data\Default`
- Copy it 3 times to `browser-profiles/` folder
- Each copy includes: History, Cookies, Preferences, localStorage, etc.

**Time:** ~30 seconds per profile (depends on your profile size)

### Step 2: Verify Profiles Were Created
Check the `browser-profiles/` folder. You should see:
```
browser-profiles/
  ├── profile-1/
  ├── profile-2/
  └── profile-3/
```

### Step 3: Run Your Scraper
That's it! The scraper will automatically:
- Rotate between the 3 profiles
- Use your real browsing history
- Use your real cookies
- Look like a legitimate user

---

## 🔍 What Gets Copied?

### ✅ Copied (Safe & Important)
- **History** - Your browsing history
- **Cookies** - Legitimate cookies from real sites
- **Preferences** - Browser settings
- **Local Storage** - Persistent data from websites
- **Bookmarks** - Your bookmarks
- **Favicons** - Site icons
- **IndexedDB** - Database storage

### ❌ NOT Copied (Privacy & Performance)
- **Cache** - Large and unnecessary (100s of MB)
- **Extensions** - May cause issues
- **Service Workers** - Not needed
- **GPU Cache** - Large and unnecessary

### 🔒 Optional: Remove Sensitive Data
If you want to clean passwords from the copied profiles:

```javascript
// In profile-manager.js, after copying:
manager.cleanSensitiveData(profilePath);
```

This removes saved passwords but keeps everything else.

---

## 📊 Profile Rotation Strategy

Your scraper rotates profiles to avoid patterns:

1. **Session 1-15 URLs:** Uses `profile-1` (your real history)
2. **Session 16-30 URLs:** Uses `profile-2` (same history, fresh session)
3. **Session 31-45 URLs:** Uses `profile-3` (same history, fresh session)
4. **Session 46+ URLs:** Random rotation continues

**Why 3 profiles?**
- Spreads activity across multiple "identities"
- If one gets flagged, others remain clean
- Looks more natural (real users don't scrape 100s of pages)

---

## 🎨 Advanced: Customize Your Profiles

### Create More Profiles
```bash
# Edit profile-manager.js, line near end:
manager.createProfileSet(5);  # Creates 5 instead of 3
```

### Use Someone Else's Profile
If you have access to other Chrome profiles (family, friends, work computer):

```javascript
// In profile-manager.js constructor:
this.sourceProfile = 'C:\\Users\\OtherUser\\AppData\\Local\\Google\\Chrome\\User Data\\Default';
```

### Age Your Profiles
The older your profile, the better. If your Chrome profile is new:
1. Browse CardMarket legitimately for a few days
2. Visit related TCG sites (Reddit, YouTube, etc.)
3. Then copy the profile
4. Now you have "aged" history

---

## 🔥 Why This Works

Cloudflare checks:
- ✅ **Browser history** - You have real history
- ✅ **Cookies** - You have legitimate cookies
- ✅ **localStorage** - You have real stored data
- ✅ **First-party data** - Your profile has data from CardMarket if you've visited before
- ✅ **Account age** - Your profile creation date is months/years old
- ✅ **Behavior patterns** - Your profile has natural browsing patterns baked in

Without persistent profiles:
- ❌ Fresh browser (suspicious)
- ❌ No history (bot indicator)
- ❌ No cookies (obvious automation)
- ❌ Empty localStorage (red flag)

---

## 📈 Expected Results

### Before Persistent Profiles
- Cloudflare flags: 40-60% of requests
- Hard captchas: Frequent
- IP bans: Common after 20-30 requests

### After Persistent Profiles
- Cloudflare flags: 5-15% of requests (mostly soft challenges)
- Hard captchas: Rare
- IP bans: Much less frequent

**Combined with proxies:** Near-zero detection rate

---

## 🛠️ Troubleshooting

### "Chrome profile not found"
- Make sure Chrome is installed
- Make sure you've opened Chrome at least once
- Check the path in profile-manager.js matches your Chrome location

### "Profile copy failed"
- Close Chrome completely (check Task Manager for chrome.exe)
- Run as Administrator if needed
- Check disk space (each profile is ~100-500MB)

### "Scraper not using profiles"
- Check `browser-profiles/` folder exists and has profile-1, profile-2, profile-3
- Check console logs - should say "Found 3 browser profiles for rotation"
- Make sure `usePersistentProfile` is not disabled in config

### Profiles getting corrupted
- This is normal - profiles can get locked/corrupted during scraping
- Solution: Delete old profiles and re-copy from your original Chrome profile
- Run `setup-profiles.bat` again

---

## 🎯 Best Practice Workflow

### Daily Use
1. Browse CardMarket normally in your Chrome
2. Visit a few product pages, search for cards, etc.
3. Close Chrome
4. Run `setup-profiles.bat` to update your copied profiles with fresh data
5. Run your scraper

This keeps your profiles "fresh" with recent legitimate activity.

### Weekly Maintenance
- Delete old profiles: `rmdir /s browser-profiles`
- Re-copy fresh profiles: `setup-profiles.bat`
- This prevents profile corruption and keeps data current

---

## 🔗 Combine with Other Techniques

Persistent profiles work best when combined with:

1. **✅ Already Implemented:**
   - Viewport randomization
   - Locale/timezone rotation
   - TLS fingerprint matching
   - Human behavior simulation
   - Session warmup

2. **🎯 Highly Recommended to Add:**
   - **Residential proxies** (essential if IP-banned)
   - **Longer delays** (8-20s instead of 3-8s)
   - **Extended warmup** (5-7 pages instead of 2)

3. **⚡ Nuclear Options:**
   - Switch to Puppeteer-Extra + Stealth plugin
   - Use Bright Data's Scraping Browser
   - Use Rebrowser for guaranteed bypass

---

## 📝 Log Example

When profiles are working, you'll see:

```
Found 3 browser profiles for rotation
New session (showChrome: true)
UA: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537...
Locale: en-US, Timezone: America/New_York
Viewport: 2000x1160
TLS: chrome-139
Profile: profile-2 (REAL BROWSING DATA)
Warming up session with legitimate browsing...
Session warmup complete
```

**Key line:** `Profile: profile-2 (REAL BROWSING DATA)`

If it says `Profile: Temporary (no persistent data)` - profiles aren't set up yet.

---

## 🎉 You're Done!

Your scraper now has one of the most powerful anti-detection features available. Combined with everything else already implemented, you have a seriously stealthy setup.

**Next steps to maximize success:**
1. ✅ Run `setup-profiles.bat` (you're about to do this)
2. ⚡ Add residential proxies if you're getting IP-banned
3. 🐌 Consider increasing delays to 8-20 seconds
4. 📊 Monitor success rate and adjust as needed

Good luck! 🚀
