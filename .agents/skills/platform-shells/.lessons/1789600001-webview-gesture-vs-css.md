---
title: A WKWebView gesture is recognized before the page — CSS cannot reach the caret loupe, `textInteractionEnabled` can
date: 2026-09-16
scope: native/App.tsx, pwa/src/styles.css, native/src/injected.ts
concepts: [wkwebview, ios, gestures, text-selection, webview-props]
---

`pwa/src/styles.css` states `user-select: none` and `-webkit-touch-callout:
none` on `*`, and `VIEWPORT_HARDENING` injects the same thing again with
`!important` for a WebView that is up before the stylesheet is. On iOS a
double tap STILL put the caret magnifier over the water — and the instinct
(the CSS must not be applying; find the element that opts back in) is wrong
and costs the session. **UIKit's text-interaction gesture recognizers are
attached to the `WKContentView` and fire before the page is consulted at
all**, so no declaration in the document can cancel them. Read a report of
"anywhere" literally: over a canvas with no text under it, a CSS explanation
cannot be the right one.

The switch is `WKPreferences.textInteractionEnabled`, which
`react-native-webview` exposes as the `textInteractionEnabled` prop (iOS
14.5+, and codegen-registered in `RNCWebViewNativeComponent.ts`, so it
survives the new architecture). It is the whole fix; `menuItems={[]}` and
`suppressMenuItems` only take rows off the callout menu and leave the lens.

**Verify a prop exists on the PINNED version before designing around it,
without installing the tree**: `npm pack react-native-webview@<version>` into
the scratchpad and grep `package/lib/WebViewTypes.d.ts` — seconds, where
`npm --prefix native install` is minutes. Then let `make native-typecheck`
be the proof, since it is the only gate that reaches `native/`.

The cost is real and belongs in the comment: with text interaction off a form
field still focuses, raises the keyboard and types, but a caret cannot be
placed mid-value. The game has exactly one such field (the seed on the start
card), which is what makes the trade payable.
