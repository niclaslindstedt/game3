// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// PLACEHOLDER — the bootstrap's stand-in for the app, so the site builds
// before the game does. The real App boots the engine off the URL's `seed`,
// `craft`, `scene`, `t` and `shot`, runs the §37 accumulator (display-rate
// sampling, fixed 120 Hz steps, a clamped delta, focus loss as a pause) and
// mounts the renderer and the HUD over it. Until it lands this draws the
// name and says it is loading, and nothing else.

import { APP_NAME } from "./identity.ts";

export function App() {
  return (
    <div class="boot" role="status">
      <span class="boot-name">{APP_NAME}</span>
      <span class="boot-note">loading · build {__BUILD_LABEL__}</span>
    </div>
  );
}
