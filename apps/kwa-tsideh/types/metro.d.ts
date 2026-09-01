/**
 * Metro's `require.context`, typed. This is what makes a source file
 * self-registering -- see src/core/registry.ts.
 */
interface MetroRequireContext {
  keys(): readonly string[];
  <T>(id: string): T;
}

declare global {
  interface NodeRequire {
    context(directory: string, useSubdirectories?: boolean, regExp?: RegExp): MetroRequireContext;
  }
}

export {};
