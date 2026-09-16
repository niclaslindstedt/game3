---
type: Fixed
title: No caret magnifier over the water in the store app
---

A double tap — or a press and hold — anywhere in the iOS app no longer summons the text cursor's magnifying lens. The website has asked for no text interaction on every element for as long as it has had a stylesheet, but the loupe is a gesture the WebView recognizes in UIKit before the page is ever consulted, so the shell now turns it off at the source. The one place a caret still belongs, the seed field on the start card, still takes the keyboard and types; a correction there is retyped rather than edited.
