import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  bundle: true,
  clean: true,
  // Bundle tool-call-machine IN so the installed plugin is self-contained (no node_modules at the
  // install target). `timmy-sdk` is import-type-only → erased by tsup, so it needs no noExternal.
  noExternal: ['tool-call-machine'],
})
