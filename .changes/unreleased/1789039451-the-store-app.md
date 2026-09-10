---
type: Added
title: The store app
---

Sea Haven now has an App Store / Play Store shell (`native/`): a thin Expo / React Native wrapper whose entire content is a full-screen WebView over a copy of the built website packed inside the app and served from a local HTTP server on launch — so the game runs on-device and offline and updates through the store. It adds an audio session so the sound survives the ringer switch, drives the phone's own haptic engine off the website's vibration table, and hands off-site links to the system browser; everything else is the website exactly as it is on the web.
