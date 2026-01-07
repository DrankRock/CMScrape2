# How to Find Your Chrome Profile

## Windows Location
Your Chrome profile is located at:
```
C:\Users\PC Info\AppData\Local\Google\Chrome\User Data
```

## What's Inside
- **Default** folder - Your main profile
- **Profile 1, Profile 2, etc.** - Additional profiles if you use Chrome's profile switcher

## Files to Look For
Key files that make your profile "real":
- `History` - Your browsing history (SQLite database)
- `Cookies` - Your cookies
- `Preferences` - Settings and configurations
- `Local Storage/` - localStorage data
- `Extensions/` - Installed extensions
- `Cache/` - Cached resources

---

## Quick Check
1. Open File Explorer
2. Paste this in the address bar: `%LOCALAPPDATA%\Google\Chrome\User Data`
3. You should see "Default" folder and other files
4. Check the size - a real profile is usually 100MB-2GB+
