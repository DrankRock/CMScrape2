const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Profile Manager - Safely manages Chrome profile copies
 *
 * Creates and maintains copies of your real Chrome profile for scraping.
 * Never modifies your original profile.
 */

class ProfileManager {
  constructor() {
    this.profilesDir = path.join(__dirname, '..', 'browser-profiles');
    this.sourceProfile = path.join(
      process.env.LOCALAPPDATA || 'C:\\Users\\Default\\AppData\\Local',
      'Google',
      'Chrome',
      'User Data',
      'Default'
    );

    // Create profiles directory if it doesn't exist
    try {
      if (!fs.existsSync(this.profilesDir)) {
        fs.mkdirSync(this.profilesDir, { recursive: true });
        console.log(`Created profiles directory: ${this.profilesDir}`);
      }
    } catch (error) {
      console.error(`Failed to create profiles directory: ${error.message}`);
    }
  }

  /**
   * Check if source profile exists
   */
  hasSourceProfile() {
    return fs.existsSync(this.sourceProfile);
  }

  /**
   * Get profile info
   */
  getProfileInfo() {
    if (!this.hasSourceProfile()) {
      return null;
    }

    try {
      const stats = fs.statSync(this.sourceProfile);
      const historyPath = path.join(this.sourceProfile, 'History');
      const cookiesPath = path.join(this.sourceProfile, 'Cookies');

      return {
        exists: true,
        path: this.sourceProfile,
        size: this.getDirectorySize(this.sourceProfile),
        hasHistory: fs.existsSync(historyPath),
        hasCookies: fs.existsSync(cookiesPath),
        modified: stats.mtime,
      };
    } catch (e) {
      return { exists: false, error: e.message };
    }
  }

  /**
   * Get directory size (recursive)
   */
  getDirectorySize(dirPath) {
    let size = 0;
    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            size += stats.size;
          } else if (stats.isDirectory()) {
            // Skip some large unnecessary folders
            if (!['Cache', 'Code Cache', 'GPUCache', 'Service Worker'].includes(file)) {
              size += this.getDirectorySize(filePath);
            }
          }
        } catch (e) {
          // Skip files we can't access
        }
      }
    } catch (e) {
      // Ignore errors
    }
    return size;
  }

  /**
   * Format bytes to human readable
   */
  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  /**
   * Copy profile (smart copy - only important files)
   */
  copyProfile(profileName) {
    if (!this.hasSourceProfile()) {
      throw new Error('Source Chrome profile not found at: ' + this.sourceProfile);
    }

    const destProfile = path.join(this.profilesDir, profileName);

    console.log(`\nCopying Chrome profile...`);
    console.log(`Source: ${this.sourceProfile}`);
    console.log(`Destination: ${destProfile}`);

    // Remove old profile if exists
    if (fs.existsSync(destProfile)) {
      console.log('Removing old profile copy...');
      this.removeDirectory(destProfile);
    }

    // Create destination
    fs.mkdirSync(destProfile, { recursive: true });

    // Files to copy (important for fingerprinting)
    const importantFiles = [
      'Preferences',
      'Local State',
      'History',
      'Cookies',
      'Login Data',
      'Web Data',
      'Bookmarks',
      'Favicons',
      'Top Sites',
    ];

    // Directories to copy
    const importantDirs = [
      'Local Storage',
      'Session Storage',
      'IndexedDB',
      'databases',
      'Local Extension Settings',
    ];

    // Copy important files
    for (const file of importantFiles) {
      const src = path.join(this.sourceProfile, file);
      const dest = path.join(destProfile, file);

      if (fs.existsSync(src)) {
        try {
          fs.copyFileSync(src, dest);
          console.log(`✓ Copied: ${file}`);
        } catch (e) {
          console.log(`✗ Failed to copy ${file}: ${e.message}`);
        }
      }
    }

    // Copy important directories
    for (const dir of importantDirs) {
      const src = path.join(this.sourceProfile, dir);
      const dest = path.join(destProfile, dir);

      if (fs.existsSync(src)) {
        try {
          this.copyDirectory(src, dest);
          console.log(`✓ Copied: ${dir}/`);
        } catch (e) {
          console.log(`✗ Failed to copy ${dir}: ${e.message}`);
        }
      }
    }

    console.log(`\n✅ Profile copied successfully!`);
    console.log(`Profile location: ${destProfile}`);

    return destProfile;
  }

  /**
   * Copy directory recursively
   */
  copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        try {
          fs.copyFileSync(srcPath, destPath);
        } catch (e) {
          // Skip locked files
        }
      }
    }
  }

  /**
   * Remove directory recursively
   */
  removeDirectory(dir) {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(file => {
        const curPath = path.join(dir, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          this.removeDirectory(curPath);
        } else {
          try {
            fs.unlinkSync(curPath);
          } catch (e) {
            // Ignore errors
          }
        }
      });
      try {
        fs.rmdirSync(dir);
      } catch (e) {
        // Ignore errors
      }
    }
  }

  /**
   * List existing profile copies
   */
  listProfiles() {
    if (!fs.existsSync(this.profilesDir)) {
      return [];
    }

    const profiles = [];
    const entries = fs.readdirSync(this.profilesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const profilePath = path.join(this.profilesDir, entry.name);
        const stats = fs.statSync(profilePath);

        profiles.push({
          name: entry.name,
          path: profilePath,
          size: this.getDirectorySize(profilePath),
          created: stats.birthtime,
          modified: stats.mtime,
        });
      }
    }

    return profiles;
  }

  /**
   * Create multiple aged profiles for rotation
   */
  createProfileSet(count = 3) {
    console.log(`\n🔧 Creating ${count} profile copies for rotation...\n`);

    const profiles = [];
    for (let i = 0; i < count; i++) {
      const profileName = `profile-${i + 1}`;
      const profilePath = this.copyProfile(profileName);
      profiles.push(profilePath);

      if (i < count - 1) {
        console.log('\n---\n');
      }
    }

    console.log(`\n✅ Created ${count} profiles for rotation`);
    return profiles;
  }

  /**
   * Get a random profile from existing copies
   */
  getRandomProfile() {
    const profiles = this.listProfiles();

    if (profiles.length === 0) {
      return null;
    }

    const randomProfile = profiles[Math.floor(Math.random() * profiles.length)];
    return randomProfile.path;
  }

  /**
   * Clean sensitive data from a profile copy (optional)
   */
  cleanSensitiveData(profilePath) {
    console.log(`\n🧹 Cleaning sensitive data from profile...`);

    const filesToRemove = [
      'Login Data',        // Saved passwords
      'Login Data-journal',
    ];

    for (const file of filesToRemove) {
      const filePath = path.join(profilePath, file);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`✓ Removed: ${file}`);
        } catch (e) {
          console.log(`✗ Failed to remove ${file}: ${e.message}`);
        }
      }
    }

    console.log('✅ Sensitive data cleaned');
  }
}

// CLI usage
if (require.main === module) {
  const manager = new ProfileManager();

  console.log('='.repeat(60));
  console.log('Chrome Profile Manager');
  console.log('='.repeat(60));

  // Check source profile
  console.log('\n📁 Checking source Chrome profile...\n');
  const info = manager.getProfileInfo();

  if (!info || !info.exists) {
    console.log('❌ Chrome profile not found!');
    console.log(`Expected location: ${manager.sourceProfile}`);
    console.log('\nMake sure you have Chrome installed and have used it at least once.');
    process.exit(1);
  }

  console.log('✅ Chrome profile found!');
  console.log(`Location: ${info.path}`);
  console.log(`Size: ${manager.formatSize(info.size)}`);
  console.log(`Has History: ${info.hasHistory ? '✓' : '✗'}`);
  console.log(`Has Cookies: ${info.hasCookies ? '✓' : '✗'}`);
  console.log(`Last Modified: ${info.modified.toLocaleString()}`);

  // List existing copies
  const existing = manager.listProfiles();
  if (existing.length > 0) {
    console.log(`\n📂 Existing profile copies: ${existing.length}`);
    existing.forEach(p => {
      console.log(`  - ${p.name} (${manager.formatSize(p.size)})`);
    });
  }

  // Create profile set
  console.log('\n' + '='.repeat(60));
  const profiles = manager.createProfileSet(3);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Setup Complete!');
  console.log('='.repeat(60));
  console.log('\nYour scraper can now use these profiles:');
  profiles.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p}`);
  });
  console.log('\nThese profiles contain your real browsing data (history, cookies, etc.)');
  console.log('They will be rotated automatically during scraping.');
  console.log('\n⚠️  Your original Chrome profile is unchanged and safe.');
}

module.exports = ProfileManager;
