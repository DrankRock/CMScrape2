# 🔧 Troubleshooting Guide

Having issues? Here's how to fix common problems.

---

## 🚨 Issue: Blank Page When Browser Opens

### Symptoms
- Browser window opens
- Page stays blank/white
- Nothing loads

### Cause
This usually means there's an error in the scraper initialization, often related to profiles.

### Solution

#### Quick Fix: Disable Profiles Temporarily
1. Open your scraper UI
2. In the console/terminal, you should see an error message
3. If it mentions "profile" or "userProfile", profiles aren't set up yet

**To run without profiles (temporary):**
- Set `usePersistentProfile: false` in config
- Or simply don't run `setup-profiles.bat` yet

The scraper will work with temporary profiles (no persistent data).

#### Permanent Fix: Set Up Profiles
1. Run: `setup-profiles.bat`
2. Wait for it to copy your Chrome profile (1-2 minutes)
3. Restart your scraper
4. You should see: `Found 3 browser profiles for rotation`

---

## 🚨 Issue: "Cannot read properties of undefined (reading 'length')"

### Error Message
```
TypeError: Cannot read properties of undefined (reading 'length')
at Function.installStorage (UserProfile.ts:95:27)
```

### Cause
Hero is trying to use a profile that doesn't exist or path is invalid.

### Solution

**Option 1: Create profiles (recommended)**
```bash
setup-profiles.bat
```

**Option 2: Disable profiles**
Edit `src/scraper.js` or your config to set:
```javascript
usePersistentProfile: false
```

**Option 3: Check profile paths**
```bash
# Verify profiles exist:
dir browser-profiles

# Should see:
# profile-1/
# profile-2/
# profile-3/
```

---

## 🚨 Issue: "Chrome profile not found"

### Symptoms
- Running `setup-profiles.bat` says Chrome profile not found
- Or profile manager can't find Chrome

### Cause
Chrome isn't installed or is in a non-standard location.

### Solution

**1. Verify Chrome is installed:**
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --version
```

**2. Check your profile location:**
```
dir "%LOCALAPPDATA%\Google\Chrome\User Data\Default"
```

**3. If Chrome is in a different location:**
Edit `src/profile-manager.js` line 15-21:
```javascript
this.sourceProfile = path.join(
  'C:\\YOUR\\CUSTOM\\PATH\\TO\\Chrome\\User Data',
  'Default'
);
```

**4. If you use Chrome Beta/Dev/Canary:**
Change the path to match your Chrome version:
- Beta: `Google\Chrome Beta\User Data\Default`
- Dev: `Google\Chrome Dev\User Data\Default`
- Canary: `Google\Chrome SxS\User Data\Default`

---

## 🚨 Issue: Scraper Crashes Immediately

### Symptoms
- Scraper starts
- Immediately crashes or exits
- No browser window appears

### Debugging Steps

**1. Run the test script:**
```bash
node test-scraper.js
```

This will show you exactly where it's failing.

**2. Check console for errors:**
Look for error messages in the terminal. Common issues:
- Module not found → Run `npm install`
- Permission denied → Close Chrome, try again
- Port in use → Close other instances

**3. Verify dependencies:**
```bash
npm install
```

**4. Check Ulixee Cloud:**
The scraper needs Ulixee Cloud to run. It should start automatically, but check logs:
```
Ulixee Cloud started at localhost:1818
```

If you see errors here, try:
```bash
npm install @ulixee/cloud @ulixee/hero
```

---

## 🚨 Issue: High Cloudflare Detection Rate

### Symptoms
- Getting flagged >20% of the time
- Lots of "CF detected" in logs
- Hard captchas appearing

### Solutions (In Order)

**1. Make sure profiles are set up:**
```bash
setup-profiles.bat
```
Log should show: `Profile: profile-X (REAL BROWSING DATA)`

**2. Increase delays:**
- Min Delay: 8000ms (instead of 3000ms)
- Max Delay: 20000ms (instead of 8000ms)

**3. Enable Session Warmup:**
- Check the "Session Warmup" checkbox in UI
- This visits the homepage before scraping

**4. Check your IP:**
If using datacenter IP or VPN, you'll get flagged more.
- Solution: Use residential proxies (see ADVANCED_OPTIONS.md)

**5. Reduce request rate:**
- Scrape fewer pages per session
- Take longer breaks between sessions

---

## 🚨 Issue: "WebSocket is not open" Error

### Error Message
```
Error: WebSocket is not open: readyState 2 (CLOSING)
```

### Cause
Connection to Hero Core was interrupted.

### Solution

**1. Don't close browser manually**
- Let the scraper close the browser
- Don't click the X while scraping

**2. Increase timeouts**
- Some sites are slow to load
- Increase Page Load Timeout in config

**3. Check network connection**
- Make sure you have stable internet
- Try a different network if issues persist

**4. Restart everything**
```bash
# Close all Chrome instances
taskkill /F /IM chrome.exe

# Restart scraper
npm start
```

---

## 🚨 Issue: Profiles Corrupted

### Symptoms
- Scraper worked before, now crashes
- Errors about profile being locked
- Browser won't start

### Solution

**1. Delete old profiles:**
```bash
rmdir /s browser-profiles
```

**2. Close Chrome completely:**
```bash
taskkill /F /IM chrome.exe
```

**3. Re-create profiles:**
```bash
setup-profiles.bat
```

**4. Restart scraper**

---

## 🧪 Testing Your Setup

### Quick Test
```bash
node test-scraper.js
```

This will:
1. Create scraper instance
2. Initialize browser
3. Navigate to CardMarket
4. Report success or failure

### What Success Looks Like
```
✅ Scraper created successfully!
✅ Browser created successfully!
✅ Navigation successful!
✅ All tests passed!
```

### What Failure Looks Like
```
❌ Test failed!
Error: [specific error message]

💡 Troubleshooting:
   - [specific suggestions]
```

---

## 📋 Pre-Flight Checklist

Before running your scraper, verify:

- [ ] Chrome is installed
- [ ] Ran `npm install` successfully
- [ ] Either:
  - [ ] Ran `setup-profiles.bat` (for persistent profiles)
  - [ ] OR set `usePersistentProfile: false` (for temporary)
- [ ] No Chrome instances running (close all Chrome windows)
- [ ] Added URLs to scrape in UI
- [ ] Configured delays (3-8s minimum)
- [ ] "Show Browser" is checked (never use headless)

---

## 🔍 Getting Detailed Logs

### Enable Debug Mode

Edit `src/scraper.js` and add more logging:

```javascript
// In createHero(), add:
console.log('DEBUG: Creating Hero with config:', heroConfig);

// In scrapeUrl(), add:
console.log('DEBUG: Fetching URL:', url);
console.log('DEBUG: Current profile:', this.currentProfilePath);
```

### Check Hero Logs

Hero logs to console. Look for:
- Connection errors
- Timeout messages
- Navigation failures

---

## 💬 Still Having Issues?

### Information to Provide

When asking for help, include:

1. **Error message** (full text)
2. **What you were doing** when it failed
3. **Console output** (last 20-30 lines)
4. **Your configuration:**
   - Profiles enabled? (`Found X profiles` in logs)
   - Delays configured?
   - Warmup enabled?
5. **System info:**
   - Windows version
   - Chrome version
   - Node.js version: `node --version`

### Common Issues Summary

| Issue | Quick Fix |
|-------|-----------|
| Blank page | Run `setup-profiles.bat` or set `usePersistentProfile: false` |
| Profile errors | Delete `browser-profiles/` and re-run setup |
| High CF rate | Increase delays to 8-20s, enable warmup |
| Crashes | Run `node test-scraper.js` to diagnose |
| WebSocket error | Close Chrome, increase timeouts |

---

## 🎯 Quick Commands Reference

```bash
# Set up profiles (do this once)
setup-profiles.bat

# Test your setup
node test-scraper.js

# Check if profiles exist
dir browser-profiles

# Kill all Chrome instances
taskkill /F /IM chrome.exe

# Reinstall dependencies
npm install

# Check versions
node --version
npm --version
chrome --version

# Start scraper
npm start
```

---

## ✅ Verification Steps

After fixing issues, verify everything works:

1. **Test with test script:**
   ```bash
   node test-scraper.js
   ```

2. **Check profiles:**
   ```bash
   dir browser-profiles
   # Should see profile-1, profile-2, profile-3
   ```

3. **Run a small scrape:**
   - Add 2-3 URLs
   - Start scraper
   - Watch for "Profile: profile-X (REAL BROWSING DATA)"
   - Verify pages load

4. **Monitor success rate:**
   - Should see <15% CF detection
   - Hard captchas should be rare
   - Most scrapes successful

---

*Last updated: 2026-01-07*
