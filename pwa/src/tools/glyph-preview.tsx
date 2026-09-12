// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GLYPH CONTACT SHEET — every mark in menu-glyphs.tsx, at the three
// sizes it is read at, over the plate it is read on.
//
// A mark is judged SMALL. 14px is a caption's mark, 22px a row's, 40px a
// front-door tile's — and a drawing that reads at 40 can be a blob at 14,
// which is the failure this page exists to catch. It cannot be caught in a
// screenshot of the menu: a tile shows one mark at one size against three
// others, so a silhouette that has gone to mush comes back looking like a
// card that is fine.
//
// It renders the real component rather than a copy of its paths, so the
// sheet can never quietly disagree with the cards.

import { render } from "preact";

// The app's own stylesheet, for the one rule that matters here: `.menu-glyph`
// is sized in `em`, and an SVG with no size at all collapses to nothing in a
// flex row. Restating that rule on this page would be a second copy to keep
// in step; importing it shows the mark at exactly the size the cards give it.
import "../styles.css";
import { GLYPH_NAMES, Glyph } from "../game/menu-glyphs.tsx";

/** The sizes the marks are used at, px. */
const SIZES = [14, 22, 40];

function Sheet() {
  return (
    <>
      <style>{`
        body { margin: 0; padding: 18px; background: #0b3d4f; color: #f2f7f8;
               font: 600 11px/1.2 system-ui, sans-serif; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .cell { display: flex; flex-direction: column; align-items: center; gap: 10px;
                background: rgb(27 111 138 / 55%); border: 2px solid rgb(242 247 248 / 26%);
                border-radius: 10px; padding: 12px 8px; }
        .row { display: flex; align-items: center; justify-content: center; gap: 12px;
               min-height: 44px; color: #f28c28; }
        .name { letter-spacing: 0.14em; opacity: 0.8; text-transform: uppercase; }
      `}</style>
      <div class="grid">
        {GLYPH_NAMES.map((name) => (
          <div key={name} class="cell">
            <div class="row">
              {SIZES.map((size) => (
                <span key={size} style={{ fontSize: `${size}px`, display: "flex" }}>
                  <Glyph name={name} />
                </span>
              ))}
            </div>
            <span class="name">{name}</span>
          </div>
        ))}
      </div>
    </>
  );
}

const host = document.getElementById("sheet");
if (host) render(<Sheet />, host);
// The screenshot pass waits on this rather than on a timeout.
(window as unknown as { __done?: boolean }).__done = true;
