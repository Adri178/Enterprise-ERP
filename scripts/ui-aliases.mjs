import { createRequire, registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
const webRequire = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/"))
      return nextResolve(
        fileURLToPath(
          new URL(
            `../.local/test-build/web/src/${specifier.slice(2)}.js`,
            import.meta.url,
          ),
        ),
        context,
      );
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        error.code !== "MODULE_NOT_FOUND" ||
        specifier.startsWith(".") ||
        specifier.startsWith("node:")
      )
        throw error;
      return nextResolve(webRequire.resolve(specifier), context);
    }
  },
});
