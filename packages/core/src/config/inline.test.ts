import { describe, it, expect } from "vitest";
import {
  extractInlineConfig,
  hasInlineConfig,
  mergeInlineConfig,
} from "./inline.ts";

describe("Inline Config", () => {
  describe("extractInlineConfig", () => {
    describe("JSON config", () => {
      it("should extract JSON config block", () => {
        const content = `#+TITLE: Test
#+NAME: config
#+begin_src json
{
  "outDir": "dist",
  "base": "/docs/"
}
#+end_src

* Content
`;
        const result = extractInlineConfig(content);

        expect(result).not.toBeNull();
        expect(result!.config).toEqual({
          outDir: "dist",
          base: "/docs/",
        });
        expect(result!.language).toBe("json");
      });

      it("should handle JSON with nested objects", () => {
        const content = `#+NAME: config
#+begin_src json
{
  "outDir": "dist",
  "vite": {
    "server": {
      "port": 3000
    }
  }
}
#+end_src
`;
        const result = extractInlineConfig(content);

        expect(result).not.toBeNull();
        expect(result!.config).toEqual({
          outDir: "dist",
          vite: {
            server: {
              port: 3000,
            },
          },
        });
      });

      it("should return null for invalid JSON", () => {
        const content = `#+NAME: config
#+begin_src json
{ invalid json }
#+end_src
`;
        const result = extractInlineConfig(content);
        expect(result).toBeNull();
      });

      it("should return null for JSON array", () => {
        const content = `#+NAME: config
#+begin_src json
["not", "an", "object"]
#+end_src
`;
        const result = extractInlineConfig(content);
        expect(result).toBeNull();
      });
    });

    describe("JavaScript config", () => {
      it("should extract export default config", () => {
        const content = `#+NAME: config
#+begin_src javascript
export default {
  outDir: "dist",
  base: "/",
};
#+end_src
`;
        const result = extractInlineConfig(content);

        expect(result).not.toBeNull();
        expect(result!.config).toEqual({
          outDir: "dist",
          base: "/",
        });
        expect(result!.language).toBe("javascript");
      });

      it("should extract module.exports config", () => {
        const content = `#+NAME: config
#+begin_src js
module.exports = {
  outDir: "build",
};
#+end_src
`;
        const result = extractInlineConfig(content);

        expect(result).not.toBeNull();
        expect(result!.config).toEqual({
          outDir: "build",
        });
      });

      it("should extract plain object config", () => {
        const content = `#+NAME: config
#+begin_src javascript
{
  outDir: "dist",
  buildConcurrency: 4,
}
#+end_src
`;
        const result = extractInlineConfig(content);

        expect(result).not.toBeNull();
        expect(result!.config).toEqual({
          outDir: "dist",
          buildConcurrency: 4,
        });
      });
    });

    describe("TypeScript config", () => {
      it("should extract TypeScript config", () => {
        const content = `#+NAME: config
#+begin_src typescript
export default {
  outDir: "dist",
  base: "/app/",
};
#+end_src
`;
        const result = extractInlineConfig(content);

        expect(result).not.toBeNull();
        expect(result!.config).toEqual({
          outDir: "dist",
          base: "/app/",
        });
        expect(result!.language).toBe("typescript");
      });

      it("should handle ts shorthand", () => {
        const content = `#+NAME: config
#+begin_src ts
export default {
  contentDir: "content",
};
#+end_src
`;
        const result = extractInlineConfig(content);

        expect(result).not.toBeNull();
        expect(result!.config).toEqual({
          contentDir: "content",
        });
        expect(result!.language).toBe("typescript");
      });
    });

    describe("edge cases", () => {
      it("should return null when no config block", () => {
        const content = `#+TITLE: Test
* Heading
Some content
`;
        const result = extractInlineConfig(content);
        expect(result).toBeNull();
      });

      it("should return null for non-config named block", () => {
        const content = `#+NAME: settings
#+begin_src json
{ "key": "value" }
#+end_src
`;
        const result = extractInlineConfig(content);
        expect(result).toBeNull();
      });

      it("should handle case-insensitive NAME", () => {
        const content = `#+name: config
#+begin_src json
{ "outDir": "dist" }
#+end_src
`;
        const result = extractInlineConfig(content);

        expect(result).not.toBeNull();
        expect(result!.config.outDir).toBe("dist");
      });

      it("should handle case-insensitive begin_src/end_src", () => {
        const content = `#+NAME: config
#+BEGIN_SRC json
{ "outDir": "dist" }
#+END_SRC
`;
        const result = extractInlineConfig(content);

        expect(result).not.toBeNull();
        expect(result!.config.outDir).toBe("dist");
      });

      it("should track line numbers", () => {
        const content = `#+TITLE: Test
#+DESCRIPTION: Test file

#+NAME: config
#+begin_src json
{ "outDir": "dist" }
#+end_src

* Content
`;
        const result = extractInlineConfig(content);

        expect(result).not.toBeNull();
        expect(result!.startLine).toBe(5);
        expect(result!.endLine).toBe(7);
      });

      it("should ignore unsupported languages", () => {
        const content = `#+NAME: config
#+begin_src python
config = {"outDir": "dist"}
#+end_src
`;
        const result = extractInlineConfig(content);
        expect(result).toBeNull();
      });

      it("should handle empty config block", () => {
        const content = `#+NAME: config
#+begin_src json

#+end_src
`;
        const result = extractInlineConfig(content);
        expect(result).toBeNull();
      });

      it("should use first config block if multiple exist", () => {
        const content = `#+NAME: config
#+begin_src json
{ "outDir": "first" }
#+end_src

#+NAME: config
#+begin_src json
{ "outDir": "second" }
#+end_src
`;
        const result = extractInlineConfig(content);

        expect(result).not.toBeNull();
        expect(result!.config.outDir).toBe("first");
      });
    });
  });

  describe("hasInlineConfig", () => {
    it("should return true when config block exists", () => {
      const content = `#+NAME: config
#+begin_src json
{ "outDir": "dist" }
#+end_src
`;
      expect(hasInlineConfig(content)).toBe(true);
    });

    it("should return false when no config block", () => {
      const content = `#+TITLE: Test
* Content
`;
      expect(hasInlineConfig(content)).toBe(false);
    });
  });

  describe("mergeInlineConfig", () => {
    it("should merge configs with inline overriding base", () => {
      const base = {
        outDir: "dist",
        base: "/",
        contentDir: "content",
      };

      const inline = {
        outDir: "build",
        base: "/docs/",
      };

      const result = mergeInlineConfig(base, inline);

      expect(result).toEqual({
        outDir: "build",
        base: "/docs/",
        contentDir: "content",
      });
    });

    it("should handle empty inline config", () => {
      const base = {
        outDir: "dist",
        base: "/",
      };

      const result = mergeInlineConfig(base, {});

      expect(result).toEqual(base);
    });

    it("should handle empty base config", () => {
      const inline = {
        outDir: "build",
      };

      const result = mergeInlineConfig({}, inline);

      expect(result).toEqual(inline);
    });
  });
});
