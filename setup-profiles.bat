@echo off
echo ========================================
echo Chrome Profile Setup
echo ========================================
echo.
echo This will copy your real Chrome profile
echo and create 3 copies for scraping rotation.
echo.
echo Your original profile will NOT be modified.
echo.
pause

node src/profile-manager.js

echo.
echo ========================================
echo Setup complete!
echo ========================================
echo.
echo You can now run your scraper.
echo It will automatically use these profiles.
echo.
pause
