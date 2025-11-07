/**
 * Runtime polyfills for esbuild helper functions
 *
 * Fixes: "Uncaught ReferenceError: __name is not defined" that can occur
 * when dependencies are pre-bundled with esbuild (e.g., Vite optimizeDeps
 * with keepNames) and the helper isn't present in a given chunk.
 *
 * This polyfill safely provides a global __name implementation.
 */

declare global {
  // Augment globalThis with the __name helper used by esbuild

  interface GlobalThis {
    __name?: (fn: Function, name: string) => Function
  }
}

// Define a safe global fallback if not already provided by a chunk
if (typeof globalThis.__name !== 'function') {
  try {
    Object.defineProperty(globalThis, '__name', {
      // Keep signature compatible with esbuild's helper
      value: function (fn: Function, name: string): Function {
        try {
          // Attempt to set the function name in a configurable way
          Object.defineProperty(fn, 'name', { value: name, configurable: true })
        } catch {
          // Silently ignore environments where function name is not writable
        }
        return fn
      },
      writable: false,
      enumerable: false,
      configurable: true,
    })
  } catch {
    // In extremely constrained environments, fall back to direct assignment
    globalThis.__name = (fn: Function, _name: string) => fn
  }
}

export {}
