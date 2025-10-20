#!/bin/bash
# QuickGet Remote v0.0.1 beta — Useful Commands

PROJECT_DIR="/Users/oleg056/Git/QuickGet-Remote"

echo "🎉 QuickGet Remote v0.0.1 beta — Project Commands"
echo "========================================"
echo ""

# List all useful commands
cat << 'EOF'
📦 BUILD & DEVELOPMENT
======================

1. Build production version:
   npm run build
   
2. Watch mode (rebuild on changes):
   npm run dev
   
3. Lint code:
   npm run lint
   npm run lint:fix
   
4. Format code:
   npm run format

🚀 BROWSER LOADING
===================

Chrome/Edge/Chromium:
   1. Go to: chrome://extensions (or edge://extensions)
   2. Enable "Developer mode" (top-right)
   3. Click "Load unpacked"
   4. Select: /Users/oleg056/Git/QuickGet-Remote/dist/
   
Firefox:
   1. Go to: about:debugging#/runtime/this-firefox
   2. Click "Load Temporary Add-on"
   3. Select: /Users/oleg056/Git/QuickGet-Remote/dist/manifest.json

📁 FILE LOCATIONS
==================

Source code:         /Users/oleg056/Git/QuickGet-Remote/src/
Build output:        /Users/oleg056/Git/QuickGet-Remote/dist/
Icons:              /Users/oleg056/Git/QuickGet-Remote/icons/
Locales:            /Users/oleg056/Git/QuickGet-Remote/_locales/

📖 DOCUMENTATION
=================

Important files:
   - DEPLOYMENT.md       ← How to load extension
   - DEVELOPER_GUIDE.md  ← API reference
   - README.md           ← Quick start
   - MIGRATION.md        ← v2.8 → v2.9 changes
   - RU_SUMMARY.md       ← Russian summary

📊 PROJECT STRUCTURE
====================

src/background/
  ├── index.ts         Service worker setup
  ├── menus.ts         Context menu handler
  ├── actions.ts       UI state management
  └── alarms.ts        Download monitoring

src/lib/
  ├── config.ts        Types & defaults
  ├── settings.ts      Storage wrapper
  └── qnap.ts          QNAP API client

src/popup/
  ├── index.ts         Form logic
  ├── index.html       UI layout
  └── index.css        Styles

src/ui/
  └── progressIndicator.ts    Progress component

🔧 GIT WORKFLOW
================

Check status:
   git status

Stage all changes:
   git add .

Commit:
   git commit -m "message"

Create version tag:
   git tag -a v0.0.1-beta -m "Release v0.0.1-beta"

🧪 TESTING CHECKLIST
====================

After loading extension:
   [ ] Context menu appears on right-click
   [ ] Popup opens and shows settings form
   [ ] Can save QNAP settings
   [ ] Connection test works
   [ ] Can list current downloads
   [ ] Debug logs are visible
   [ ] Right-click "Send with QuickGet" works

📝 TYPICAL WORKFLOW
====================

# First time setup:
npm install
npm run build

# Edit code:
# ... modify files in src/

# Rebuild:
npm run build

# Test in browser:
# ... reload extension in chrome://extensions

# Commit when happy:
git add .
git commit -m "feature: add new feature"

✨ TIPS & TRICKS
================

1. Use Debug Logs section in popup to troubleshoot
2. Check browser console (F12) for errors
3. Service worker logs appear in chrome://extensions (Details tab)
4. Source maps are included for easier debugging
5. Extension reloads on manifest.json changes

🎓 KEY MODULES
================

config.ts:
   - Export types: Settings, DEFAULTS
   - Use: import { DEFAULTS } from '@lib/config'

qnap.ts:
   - buildNASBaseUrl()
   - loginNAS()
   - addDownloadUrl()
   - queryNASTasks()
   Use: import * as qnap from '@lib/qnap'

settings.ts:
   - loadSettings()
   - saveSettings()
   - resetSettings()
   Use: import { loadSettings } from '@lib/settings'

progressIndicator.ts:
   - createProgressIndicator()
   - updateProgress()
   Use: import { createProgressIndicator } from '@ui'

📞 TROUBLESHOOTING
===================

Extension won't load:
   1. Check manifest.json syntax: cat dist/manifest.json
   2. Verify dist/background/index.js exists
   3. Look for errors in chrome://extensions (Details tab)
   4. Check Firefox console if using Firefox

Settings not saving:
   1. Check browser storage permission
   2. Look in popup debug logs
   3. Check browser console for errors
   4. Try chrome://extensions → Details → "Inspect background"

QNAP connection fails:
   1. Check QNAP address and port are correct
   2. Verify QNAP server is running
   3. Check firewall isn't blocking connection
   4. Look in Debug Logs for exact error
   5. Check QNAP credentials in settings

🎯 NEXT STEPS
==============

1. Load extension in browser (see BROWSER LOADING section)
2. Test all features (see TESTING CHECKLIST)
3. If issues, check TROUBLESHOOTING section
4. Read DEVELOPER_GUIDE.md for detailed API docs
5. Read MIGRATION.md if upgrading from v2.8

📧 SUPPORT
===========

For questions:
   1. Check the 9 documentation files (INDEX.md is a good start)
   2. Review DEVELOPER_GUIDE.md for API reference
   3. Look at Debug Logs in popup extension
   4. Check browser console (F12 → Console tab)

✅ DEPLOYMENT READY
====================

✓ All TypeScript modules compiled
✓ All assets copied to dist/
✓ manifest.json ready for loading
✓ Icons and locales configured
✓ Source maps included for debugging

Ready to test! 🚀

EOF

echo ""
echo "Created: /Users/oleg056/Git/QuickGet-Remote/COMMANDS.sh"
echo "To view again, run: cat /Users/oleg056/Git/QuickGet-Remote/COMMANDS.sh"
