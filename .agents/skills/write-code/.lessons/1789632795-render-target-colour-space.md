---
title: Three compiles for LINEAR output whenever it draws into a render target, whatever the target's texture says — so an 8-bit target needs `colorSpace: SRGBColorSpace` to get the GPU's own encode and avoid banding
date: 2026-09-17
scope: pwa/src/game/grade-pass.ts, pwa/src/game/reflection.ts, pwa/src/game/wake.ts
concepts: [three, render-target, colour, shader, banding]
---

`WebGLProgram`'s `outputColorSpace` parameter is
`currentRenderTarget === null ? renderer.outputColorSpace : LinearSRGBColorSpace`
(`node_modules/three/build/three.cjs`, one line in `getParameters`). So every
`#include <colorspace_fragment>` in the scene becomes a no-op the moment the
frame is drawn off-screen, and what lands in the target is LINEAR light —
however the target's `texture.colorSpace` is set. The tempting readings are
both wrong: the target does not encode because you asked it to, and an 8-bit
linear buffer bands visibly in the darks, which reads as a grade's fault
rather than a buffer's.

`type: HalfFloatType` fixes it at eight bytes a pixel of bandwidth, which on
a phone is the wrong price. The cheap fix is the target's colour space:
`colorSpace: THREE.SRGBColorSpace` makes three allocate `SRGB8_ALPHA8`
(`glType === UNSIGNED_BYTE && transfer === SRGBTransfer` in `getInternalFormat`),
and from there the GPU encodes on every write and decodes on every read, in
hardware and for free. Four bytes a pixel, sRGB's precision where the eye
needs it, and a shader sampling it still gets the linear light the scene
computed — no decode to write, and nothing for three to inject.

Two more things a pass needs and one of the repo's own render targets each
gets wrong by omission: `samples: n` on the target, because `antialias` on
the context only ever multisampled the DEFAULT framebuffer, and saving
`renderer.getRenderTarget()` to restore rather than assuming `null`.
`renderer.render()` resets `renderer.info` at the top of every call, so a
second pass's draw calls have to be read off the FIRST render before it runs.
