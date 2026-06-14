import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  bundle: true,
  clean: true,
  // Bundle the machine package IN so the installed plugin is self-contained (no node_modules
  // at the install target). `timmy-sdk` is import-type-only → erased by tsup, so it needs no
  // noExternal entry. Phase 3.1 switches both to npm deps and drops the bundling.
  noExternal: ['@agent-tool-calls/machine'],
})
