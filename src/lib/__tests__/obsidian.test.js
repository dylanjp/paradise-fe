/**
 * Tests for the Obsidian markdown renderer and link resolution.
 *
 * The fixture tree mirrors the real vault layouts: the main DOCS_PATH root plus
 * the admin-only "LE Docs" and "Pratt Capitol" roots, nested vaults with
 * vault-relative paths, and duplicate note names (Amira, Daken, Human).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  normalizeKey,
  parseWikiTarget,
  buildDocsIndex,
  resolveDocLink,
  slugifyHeading,
  renderObsidianMarkdown,
} from "../obsidian";
import { sanitizeHtml, HEADING_ID_RE } from "../sanitizeHtml";

const LE = "LE Docs";
const IP = `${LE}/IP Management/Lamaryah WorldBuilding`;
const SB = `${LE}/Projects/Development/Project SwordBreak`;

// NFC vs NFD spellings of "Cafe" with an acute accent
const CAFE_NFC = "Caf" + String.fromCharCode(0xe9);
const CAFE_NFD = "Cafe" + String.fromCharCode(0x301);

const FILE_PATHS = [
  "Welcome.md",
  "Home (Tessa)/Network/Network.md",
  "Home (Tessa)/Network/Network Diagram.canvas",
  "Insurance/Insurance.md",
  "Insurance/Car Insurance/ID Card.pdf",
  `${LE}/Amira Artwork.md`,
  `${LE}/${CAFE_NFC}.md`,
  `${LE}/Mr. Smith.md`,
  `${IP}/Characters/Amira/Amira.md`,
  `${IP}/Characters/Amira/Amira Board.canvas`,
  `${IP}/Characters/The 7 Atrocities/Daken/Daken.md`,
  `${IP}/Peoples/Human/Human.md`,
  `${IP}/Peoples/Elf/Elf.md`,
  `${SB}/Worldbuilding/Characters/Main Characters/Amira/Amira.md`,
  `${SB}/Worldbuilding/Characters/Main Characters/Daken/Daken.md`,
  `${SB}/Worldbuilding/Object & Artifacts/Faithkeeper.md`,
  `${SB}/Worldbuilding/Object & Artifacts/Honor's Guard.md`,
  `${SB}/Worldbuilding/Peoples/Human/Human.md`,
  `${SB}/Developer Notes/SystemDialog/Dialog System.md`,
  "Pratt Capitol/Faithkeeper.md",
];

const ROOT_LABELS = new Set([LE, "Pratt Capitol"]);

/** Builds a DocsTreeNode tree (as served by GET /docs/tree) from file paths */
function buildTree(paths) {
  const root = { name: "", type: "folder", path: "", children: [] };
  for (const path of paths) {
    const parts = path.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.path === folderPath);
      if (!child) {
        child = {
          name: parts[i],
          type: "folder",
          path: folderPath,
          children: [],
        };
        if (i === 0 && ROOT_LABELS.has(parts[0])) child.root = true;
        node.children.push(child);
      }
      node = child;
    }
    node.children.push({
      name: parts[parts.length - 1],
      type: "file",
      path,
      children: null,
    });
  }
  return root;
}

const TREE = buildTree(FILE_PATHS);
const INDEX = buildDocsIndex(TREE);

// The user's sample, verbatim
const AMIRA_SAMPLE =
  "*Physical Description:*\nAmira is 5’7 with green eyes and long blonde hair. Red studded earrings. Biological Age: 22\n\n![[IP Management/Lamaryah WorldBuilding/Attachments/Pictures/Amira/Official_Amira_Artwork2.jpg]]\n\nFor more art see: [[Amira Artwork]]\n\n*Skills/Talents:*\nSwordswomen Prodigy, Simple Magic, Music Prodigy\n\n*Weapons:*\n[[Faithkeeper]] (Sword), [[Honor's Guard]] (Shield)\n\n*Character History*\n-Born 15876 AD\n-Amira duels [[IP Management/Lamaryah WorldBuilding/Characters/The 7 Atrocities/Daken/Daken]] at 20\n\n#projectionswordbreak #character #amira";

const AMIRA_PATH = `${SB}/Worldbuilding/Characters/Main Characters/Amira/Amira.md`;

/** Parses HTML into an inert document body */
function parse(html) {
  return new DOMParser().parseFromString(html, "text/html").body;
}

/** Renders with the fixture index and parses the result */
function render(markdown, options = {}) {
  return parse(
    renderObsidianMarkdown(markdown, {
      currentPath: AMIRA_PATH,
      index: INDEX,
      ...options,
    }),
  );
}

/** URL check matching what the browser would execute (control chars stripped) */
function isDangerousUrl(value) {
  const v = String(value)
    .replace(/[\x00-\x20\x7f]/g, "")
    .toLowerCase();
  return (
    /^(javascript|vbscript|livescript|blob|file):/.test(v) ||
    /^data:(?!image\/)/.test(v)
  );
}

/** Asserts no handlers, dangerous URLs or script-capable elements are present */
function expectInert(body) {
  for (const el of body.querySelectorAll("*")) {
    expect([
      "script",
      "iframe",
      "object",
      "embed",
      "svg",
      "math",
      "style",
      "base",
    ]).not.toContain(el.localName);
    for (const attr of Array.from(el.attributes)) {
      expect(attr.name.startsWith("on")).toBe(false);
      if (
        ["href", "src", "action", "formaction", "xlink:href"].includes(
          attr.name,
        )
      ) {
        expect(isDangerousUrl(attr.value)).toBe(false);
      }
    }
  }
}

describe("normalizeKey", () => {
  it("normalizes case, unicode form and separators", () => {
    expect(normalizeKey("LE Docs\\Amira.MD")).toBe("le docs/amira.md");
    expect(normalizeKey(CAFE_NFD)).toBe(normalizeKey(CAFE_NFC));
    expect(normalizeKey(null)).toBe("");
  });
});

describe("parseWikiTarget", () => {
  it("parses plain targets", () => {
    expect(parseWikiTarget("Faithkeeper")).toEqual({
      path: "Faithkeeper",
      heading: null,
      alias: null,
      width: null,
      height: null,
      rawAlias: null,
    });
  });

  it("parses aliases, headings and block references", () => {
    expect(parseWikiTarget("Amira|The Last Knight")).toMatchObject({
      path: "Amira",
      alias: "The Last Knight",
    });
    expect(parseWikiTarget("Amira#Personality")).toMatchObject({
      path: "Amira",
      heading: "Personality",
    });
    expect(parseWikiTarget("Amira#^abc123")).toMatchObject({
      path: "Amira",
      heading: "^abc123",
    });
    expect(parseWikiTarget("Amira#Personality|traits")).toMatchObject({
      path: "Amira",
      heading: "Personality",
      alias: "traits",
    });
    expect(parseWikiTarget("#Local heading")).toMatchObject({
      path: "",
      heading: "Local heading",
    });
  });

  it("parses embed sizes", () => {
    expect(parseWikiTarget("art.png|300")).toMatchObject({
      path: "art.png",
      width: 300,
      height: null,
      alias: null,
      rawAlias: "300",
    });
    expect(parseWikiTarget("art.png|300x200")).toMatchObject({
      width: 300,
      height: 200,
    });
    expect(parseWikiTarget("art.png|Concept art|640")).toMatchObject({
      alias: "Concept art",
      width: 640,
    });
  });

  it("treats Obsidian's escaped table pipe as a pipe", () => {
    expect(parseWikiTarget("Amira\\|Princess")).toMatchObject({
      path: "Amira",
      alias: "Princess",
    });
  });

  it("never throws (property)", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const r = parseWikiTarget(s);
        expect(typeof r.path).toBe("string");
      }),
    );
  });
});

describe("buildDocsIndex", () => {
  it("indexes every file with its root label", () => {
    expect(INDEX.files).toHaveLength(FILE_PATHS.length);
    expect(INDEX.rootLabels.sort()).toEqual([LE, "Pratt Capitol"]);
    expect(INDEX.byPath["Welcome.md"].rootLabel).toBe("");
    expect(INDEX.byPath[`${IP}/Characters/Amira/Amira.md`].rootLabel).toBe(LE);
    expect(INDEX.byPath.get("Pratt Capitol/Faithkeeper.md").rootLabel).toBe(
      "Pratt Capitol",
    );
    expect(INDEX.byPath.has("Insurance/Car Insurance/ID Card.pdf")).toBe(true);
    expect(INDEX.byPath.get("missing.md")).toBeUndefined();
    expect(INDEX.byPath["Insurance/Car Insurance/ID Card.pdf"]).toMatchObject({
      key: "insurance/car insurance/id card.pdf",
      kind: "pdf",
    });
    expect(Object.keys(INDEX.byPath)).toHaveLength(FILE_PATHS.length);
  });

  it("handles a missing tree", () => {
    const empty = buildDocsIndex(null);
    expect(empty.files).toEqual([]);
    expect(resolveDocLink("Anything", null, empty)).toBeNull();
  });

  it("never lets a tree path shadow the byPath helpers", () => {
    const odd = buildDocsIndex(buildTree(["get", "has", "__proto__", "a.md"]));
    expect(odd.files).toHaveLength(4);
    expect(typeof odd.byPath.get).toBe("function");
    expect(odd.byPath.get("a.md").path).toBe("a.md");
    expect(odd.byPath.has("get")).toBe(false);
  });
});

describe("resolveDocLink", () => {
  it("resolves vault-relative paths inside a prefixed root", () => {
    expect(
      resolveDocLink(
        "IP Management/Lamaryah WorldBuilding/Characters/The 7 Atrocities/Daken/Daken",
        AMIRA_PATH,
        INDEX,
      ),
    ).toBe(`${IP}/Characters/The 7 Atrocities/Daken/Daken.md`);
    // Inner-vault-relative path (Project SwordBreak is its own vault)
    expect(
      resolveDocLink(
        "Developer Notes/SystemDialog/Dialog System.md",
        AMIRA_PATH,
        INDEX,
      ),
    ).toBe(`${SB}/Developer Notes/SystemDialog/Dialog System.md`);
  });

  it("resolves bare names with an implied .md", () => {
    expect(resolveDocLink("Faithkeeper", AMIRA_PATH, INDEX)).toBe(
      `${SB}/Worldbuilding/Object & Artifacts/Faithkeeper.md`,
    );
    expect(resolveDocLink("Honor's Guard", AMIRA_PATH, INDEX)).toBe(
      `${SB}/Worldbuilding/Object & Artifacts/Honor's Guard.md`,
    );
    expect(resolveDocLink("Mr. Smith", AMIRA_PATH, INDEX)).toBe(
      `${LE}/Mr. Smith.md`,
    );
    expect(resolveDocLink("Amira Board.canvas", AMIRA_PATH, INDEX)).toBe(
      `${IP}/Characters/Amira/Amira Board.canvas`,
    );
    expect(resolveDocLink("Amira Board", AMIRA_PATH, INDEX)).toBeNull();
  });

  it("prefers the closest duplicate", () => {
    const ipAmira = `${IP}/Characters/Amira/Amira.md`;
    expect(resolveDocLink("Human", ipAmira, INDEX)).toBe(
      `${IP}/Peoples/Human/Human.md`,
    );
    expect(resolveDocLink("Human", AMIRA_PATH, INDEX)).toBe(
      `${SB}/Worldbuilding/Peoples/Human/Human.md`,
    );
    expect(resolveDocLink("Daken", AMIRA_PATH, INDEX)).toBe(
      `${SB}/Worldbuilding/Characters/Main Characters/Daken/Daken.md`,
    );
    expect(resolveDocLink("Daken", ipAmira, INDEX)).toBe(
      `${IP}/Characters/The 7 Atrocities/Daken/Daken.md`,
    );
    // From the vault root, ties go to the shortest path
    expect(resolveDocLink("Amira", `${LE}/Amira Artwork.md`, INDEX)).toBe(
      ipAmira,
    );
  });

  it("never crosses roots", () => {
    expect(resolveDocLink("Faithkeeper", "Welcome.md", INDEX)).toBeNull();
    expect(
      resolveDocLink("Faithkeeper", "Pratt Capitol/Faithkeeper.md", INDEX),
    ).toBe("Pratt Capitol/Faithkeeper.md");
    expect(resolveDocLink("Network", AMIRA_PATH, INDEX)).toBeNull();
    expect(resolveDocLink("Network", "Insurance/Insurance.md", INDEX)).toBe(
      "Home (Tessa)/Network/Network.md",
    );
    expect(
      resolveDocLink("LE Docs/Amira Artwork", "Welcome.md", INDEX),
    ).toBeNull();
  });

  it("matches case-insensitively and across unicode forms", () => {
    expect(resolveDocLink("faithKEEPER", AMIRA_PATH, INDEX)).toBe(
      `${SB}/Worldbuilding/Object & Artifacts/Faithkeeper.md`,
    );
    expect(resolveDocLink(CAFE_NFD, AMIRA_PATH, INDEX)).toBe(
      `${LE}/${CAFE_NFC}.md`,
    );
  });

  it("resolves relative and vault-absolute links", () => {
    const elf = `${IP}/Peoples/Elf/Elf.md`;
    expect(resolveDocLink("../Human/Human.md", elf, INDEX)).toBe(
      `${IP}/Peoples/Human/Human.md`,
    );
    expect(resolveDocLink("./Elf", elf, INDEX)).toBe(elf);
    expect(resolveDocLink("/Amira Artwork", elf, INDEX)).toBe(
      `${LE}/Amira Artwork.md`,
    );
  });

  it("does not match partial names", () => {
    expect(resolveDocLink("mira", AMIRA_PATH, INDEX)).toBeNull();
    expect(resolveDocLink("Keeper", AMIRA_PATH, INDEX)).toBeNull();
  });

  it("returns null for unresolved or empty targets", () => {
    expect(resolveDocLink("Nope", AMIRA_PATH, INDEX)).toBeNull();
    expect(resolveDocLink("", AMIRA_PATH, INDEX)).toBeNull();
    expect(resolveDocLink("   ", AMIRA_PATH, INDEX)).toBeNull();
    expect(resolveDocLink("Folder/", AMIRA_PATH, INDEX)).toBeNull();
    expect(resolveDocLink(null, AMIRA_PATH, INDEX)).toBeNull();
  });

  it("only ever returns null or an indexed path (property)", () => {
    const segment = fc.constantFrom(
      "Amira",
      "Daken",
      "Human",
      "..",
      ".",
      "",
      "LE Docs",
      "Faithkeeper.md",
      "x.png",
      "Peoples",
      "IP Management",
      "#",
      "|",
      "\\",
      "Welcome",
    );
    fc.assert(
      fc.property(
        fc.array(segment, { maxLength: 6 }).map((a) => a.join("/")),
        fc.constantFrom(...FILE_PATHS, null, "Unknown/Path.md"),
        (target, from) => {
          const result = resolveDocLink(target, from, INDEX);
          expect(result === null || FILE_PATHS.includes(result)).toBe(true);
        },
      ),
    );
  });
});

describe("slugifyHeading", () => {
  it("follows GitHub's anchor rules", () => {
    expect(slugifyHeading("General Information")).toBe("general-information");
    // Punctuation is deleted, not turned into "-"; runs of "-" are kept
    expect(slugifyHeading("  Height & Build!  ")).toBe("height--build");
    expect(slugifyHeading("Honor's Guard v1.0 (A/B)")).toBe("honors-guard-v10-ab");
    expect(slugifyHeading("Gotcha 3 — LFS mangles UNC paths")).toBe(
      "gotcha-3--lfs-mangles-unc-paths",
    );
    expect(slugifyHeading("✅ Verification test (DO THIS — don't skip)")).toBe(
      "-verification-test-do-this--dont-skip",
    );
    expect(slugifyHeading("snake_case and-dash")).toBe("snake_case-and-dash");
    expect(slugifyHeading("???")).toBe("section");
    expect(slugifyHeading("x".repeat(200))).toHaveLength(80);
  });

  it("keeps Unicode letters and matches NFC and NFD spellings", () => {
    expect(slugifyHeading(CAFE_NFC + " Menu")).toBe("café-menu");
    expect(slugifyHeading(CAFE_NFD + " Menu")).toBe("café-menu");
    expect(slugifyHeading("Über Straße")).toBe("über-straße");
    expect(slugifyHeading("日本語 見出し")).toBe("日本語-見出し");
    // Cut on code points, never inside a surrogate pair
    expect(Array.from(slugifyHeading("𝒶".repeat(100)))).toHaveLength(80);
  });

  it("always yields an id the sanitizer keeps, and maps a slug to itself (property)", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary", maxLength: 120 }), (s) => {
        const slug = slugifyHeading(s);
        expect(HEADING_ID_RE.test(`docs-h-${slug}`)).toBe(true);
        expect(slugifyHeading(slug)).toBe(slug);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("renderObsidianMarkdown: heading links (GitHub-style table of contents)", () => {
  // Headings and TOC links from the vault's "Git Backup Setup" note
  const NOTE = [
    "# Project SwordBreak — Git Backup Setup",
    "",
    "Three places (the [3-2-1 backup idea](#backup-strategy-3-2-1)).",
    "See [Remote configuration](#remote-configuration) and [Gotcha 3](#gotcha-3--lfs-mangles-unc-paths).",
    "Run the [verification test](#-verification-test-do-this--dont-skip) first.",
    "",
    "## Remote configuration",
    "### ✅ Verification test (DO THIS — don't skip)",
    "## Backup strategy (3-2-1)",
    "### Gotcha 3 — LFS mangles UNC paths",
    "### Server side (`EPIC-SERVER`)",
  ].join("\n");

  it("points every TOC link at a heading id that survives sanitizing", () => {
    const body = parse(sanitizeHtml(renderObsidianMarkdown(NOTE)));
    const ids = Array.from(body.querySelectorAll("h1, h2, h3"), (h) => h.id);
    expect(ids).toEqual([
      "docs-h-project-swordbreak--git-backup-setup",
      "docs-h-remote-configuration",
      "docs-h--verification-test-do-this--dont-skip",
      "docs-h-backup-strategy-3-2-1",
      "docs-h-gotcha-3--lfs-mangles-unc-paths",
      "docs-h-server-side-epic-server",
    ]);
    const hrefs = Array.from(body.querySelectorAll("a"), (a) => a.getAttribute("href"));
    expect(hrefs).toHaveLength(4);
    for (const href of hrefs) expect(ids).toContain(href.slice(1));
  });

  it("links [[#Heading]] and percent-encoded anchors to Unicode headings", () => {
    const body = parse(
      sanitizeHtml(
        renderObsidianMarkdown("## Über uns\n\n[[#Über uns]] [x](#%C3%9Cber%20uns) [y](#über-uns)"),
      ),
    );
    expect(body.querySelector("h2").id).toBe("docs-h-über-uns");
    expect(Array.from(body.querySelectorAll("a"), (a) => a.getAttribute("href"))).toEqual([
      "#docs-h-über-uns",
      "#docs-h-über-uns",
      "#docs-h-über-uns",
    ]);
  });

  it("keeps ids unique the way GitHub does", () => {
    const ids = Array.from(
      render("# A\n## A\n### A-1\n#### A\n##### Setup ✅\n###### Setup").querySelectorAll(
        "h1,h2,h3,h4,h5,h6",
      ),
      (h) => h.id,
    );
    expect(ids).toEqual([
      "docs-h-a",
      "docs-h-a-1",
      "docs-h-a-1-1",
      "docs-h-a-2",
      "docs-h-setup-",
      "docs-h-setup",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("renderObsidianMarkdown: the Amira sample", () => {
  const body = render(AMIRA_SAMPLE);

  it("embeds the artwork image for the backend to resolve", () => {
    const img = body.querySelector("img[data-embed-target][data-embed-from]");
    expect(img).not.toBeNull();
    expect(img.getAttribute("data-embed-target")).toBe(
      "IP Management/Lamaryah WorldBuilding/Attachments/Pictures/Amira/Official_Amira_Artwork2.jpg",
    );
    expect(img.getAttribute("data-embed-from")).toBe(AMIRA_PATH);
    expect(img.classList.contains("docs-embed-image")).toBe(true);
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.hasAttribute("src")).toBe(false);
  });

  it("resolves the wikilinks", () => {
    const links = Array.from(body.querySelectorAll("a[data-doc-link]"));
    const byText = Object.fromEntries(
      links.map((a) => [a.textContent, a.dataset.docLink]),
    );
    expect(byText["Faithkeeper"]).toBe(
      `${SB}/Worldbuilding/Object & Artifacts/Faithkeeper.md`,
    );
    expect(byText["Honor's Guard"]).toBe(
      `${SB}/Worldbuilding/Object & Artifacts/Honor's Guard.md`,
    );
    expect(byText["Amira Artwork"]).toBe(`${LE}/Amira Artwork.md`);
    expect(byText["Daken"]).toBe(
      `${IP}/Characters/The 7 Atrocities/Daken/Daken.md`,
    );
    for (const a of links) {
      expect(a.getAttribute("href")).toBe("#");
      expect(a.classList.contains("docs-internal-link")).toBe(true);
    }
  });

  it("renders the three tags", () => {
    const tags = Array.from(body.querySelectorAll("span.docs-tag")).map(
      (t) => t.textContent,
    );
    expect(tags).toEqual(["#projectionswordbreak", "#character", "#amira"]);
  });

  it("renders emphasis, line breaks and no leftover wiki syntax", () => {
    expect(
      Array.from(body.querySelectorAll("em")).map((e) => e.textContent),
    ).toEqual([
      "Physical Description:",
      "Skills/Talents:",
      "Weapons:",
      "Character History",
    ]);
    expect(body.querySelector("br")).not.toBeNull();
    expect(body.innerHTML).not.toContain("[[");
    expect(body.innerHTML).not.toContain("]]");
    expect(body.textContent).toContain("Amira is 5’7 with green eyes");
    expect(body.textContent).toContain("-Born 15876 AD");
    expect(body.querySelector("ul, li, h1")).toBeNull();
  });

  it("survives sanitizing unchanged in substance", () => {
    const clean = parse(
      sanitizeHtml(
        renderObsidianMarkdown(AMIRA_SAMPLE, {
          currentPath: AMIRA_PATH,
          index: INDEX,
        }),
      ),
    );
    const img = clean.querySelector("img[data-embed-target][data-embed-from]");
    expect(img.dataset.embedTarget).toBe(
      "IP Management/Lamaryah WorldBuilding/Attachments/Pictures/Amira/Official_Amira_Artwork2.jpg",
    );
    expect(img.dataset.embedFrom).toBe(AMIRA_PATH);
    const links = Array.from(clean.querySelectorAll("a[data-doc-link]"));
    expect(links.map((a) => a.textContent)).toEqual([
      "Amira Artwork",
      "Faithkeeper",
      "Honor's Guard",
      "Daken",
    ]);
    expect(clean.querySelectorAll("span.docs-tag")).toHaveLength(3);
    expect(clean.querySelectorAll("em")).toHaveLength(4);
    expect(clean.querySelector(".docs-unresolved-link")).toBeNull();
    expect(clean.innerHTML).not.toContain("[[");
  });
});

describe("renderObsidianMarkdown: wiki syntax", () => {
  it("marks unresolved links", () => {
    const body = render("See [[Nowhere]] and [[Nowhere|the void]]");
    const spans = body.querySelectorAll("span.docs-unresolved-link");
    expect(Array.from(spans).map((s) => s.textContent)).toEqual([
      "Nowhere",
      "the void",
    ]);
    expect(body.querySelector("a")).toBeNull();
  });

  it("uses aliases and headings in the display text", () => {
    const body = render(
      "[[Faithkeeper|the sword]] [[Faithkeeper#History]] [[2024|300]]",
    );
    const texts = Array.from(
      body.querySelectorAll(".docs-internal-link, .docs-unresolved-link"),
    ).map((e) => e.textContent);
    expect(texts).toEqual(["the sword", "Faithkeeper › History", "300"]);
  });

  it("links same-note headings to generated ids", () => {
    const body = render(
      "# Personality\n\nSee [[#Personality]] or [below](#Personality).",
    );
    expect(body.querySelector("h1").id).toBe("docs-h-personality");
    const hrefs = Array.from(body.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toEqual(["#docs-h-personality", "#docs-h-personality"]);
  });

  it("embeds images with sizes, PDFs and notes", () => {
    const body = render(
      "![[Official_Amira_Artwork1.jpg|300x200]]\n\n![[Contract.pdf]]\n\n![[Faithkeeper]]\n\n![[Amira Board.canvas]]\n\n![[Nowhere]]",
    );
    const img = body.querySelector("img.docs-embed-image");
    expect(img.getAttribute("data-embed-target")).toBe(
      "Official_Amira_Artwork1.jpg",
    );
    expect(img.getAttribute("width")).toBe("300");
    expect(img.getAttribute("height")).toBe("200");
    expect(img.getAttribute("alt")).toBe("Official_Amira_Artwork1.jpg");

    const pdf = body.querySelector("div.docs-embed-pdf");
    expect(pdf.dataset.embedPdf).toBe("Contract.pdf");
    expect(pdf.dataset.embedFrom).toBe(AMIRA_PATH);

    const note = body.querySelector("div.docs-embed-note");
    expect(note.dataset.embedNote).toBe(
      `${SB}/Worldbuilding/Object & Artifacts/Faithkeeper.md`,
    );
    expect(note.dataset.embedFrom).toBe(AMIRA_PATH);

    // Every hydratable embed says which doc it came from
    for (const el of body.querySelectorAll(
      "[data-embed-target], [data-embed-pdf], [data-embed-note]",
    )) {
      expect(el.dataset.embedFrom).toBe(AMIRA_PATH);
    }

    const canvasLink = body.querySelector("a.docs-embed-link");
    expect(canvasLink.dataset.docLink).toBe(
      `${IP}/Characters/Amira/Amira Board.canvas`,
    );
    expect(canvasLink.textContent).toBe("Amira Board");

    expect(body.querySelector("span.docs-unresolved-link").textContent).toBe(
      "Nowhere",
    );
  });

  it("does not expand note embeds below depth 0", () => {
    const body = render("![[Faithkeeper]]", { embedDepth: 1 });
    expect(body.querySelector(".docs-embed-note")).toBeNull();
    expect(body.querySelector("a[data-doc-link]").dataset.docLink).toBe(
      `${SB}/Worldbuilding/Object & Artifacts/Faithkeeper.md`,
    );
  });

  it("uses the embedding note as data-embed-from", () => {
    const embedded = `${IP}/Characters/Amira/Amira.md`;
    const body = render("![[pic.png]]", {
      currentPath: embedded,
      embedDepth: 1,
    });
    expect(body.querySelector("img").dataset.embedFrom).toBe(embedded);
  });

  it("renders [[...]] as text when wiki syntax is off", () => {
    const body = render("[[Faithkeeper]] ![[pic.png]]", { wiki: false });
    expect(body.textContent.trim()).toBe("[[Faithkeeper]] ![[pic.png]]");
    expect(body.querySelector("[data-doc-link], img")).toBeNull();
  });

  it("keeps wiki syntax inside code untouched", () => {
    const body = render(
      "`[[Faithkeeper]]` and `#tag`\n\n```\n![[x.png]] #tag ==hi==\n```",
    );
    const codes = Array.from(body.querySelectorAll("code")).map(
      (c) => c.textContent,
    );
    expect(codes).toEqual([
      "[[Faithkeeper]]",
      "#tag",
      "![[x.png]] #tag ==hi==\n",
    ]);
    expect(
      body.querySelector("[data-doc-link], .docs-tag, img, mark"),
    ).toBeNull();
  });

  it("keeps emphasis delimiters inside links from pairing outside", () => {
    const body = render("*see [[a*b]]*");
    expect(body.querySelector("em .docs-unresolved-link").textContent).toBe(
      "a*b",
    );
  });

  it("only treats #word after whitespace as a tag", () => {
    const body = render("a#b #c (#d) #1 #1a #x/y-z_1\nline\n#next");
    const tags = Array.from(body.querySelectorAll(".docs-tag")).map(
      (t) => t.textContent,
    );
    expect(tags).toEqual(["#c", "#1a", "#x/y-z_1", "#next"]);
  });

  it("finds tags after other inline tokens and inside nested inline content", () => {
    const body = render(
      "*x* #after-em **#in-strong** C#sharp ==#hl== x\\#escaped `#code`\n- #in-list",
    );
    const tags = Array.from(body.querySelectorAll(".docs-tag")).map(
      (t) => t.textContent,
    );
    expect(tags).toEqual(["#after-em", "#in-strong", "#hl", "#in-list"]);
    expect(body.textContent).toContain("C#sharp");
    expect(body.textContent).toContain("x#escaped");
  });

  it("does not turn headings into tags", () => {
    const body = render("# World Exploration\n\n## Combat");
    expect(body.querySelector(".docs-tag")).toBeNull();
    expect(body.querySelector("h1").id).toBe("docs-h-world-exploration");
  });

  it("renders ==highlights==", () => {
    expect(
      render("==hi **there**==").querySelector("mark strong").textContent,
    ).toBe("there");
  });

  it("deduplicates heading ids", () => {
    const ids = Array.from(
      render("# A\n## A\n### A").querySelectorAll("h1,h2,h3"),
    ).map((h) => h.id);
    expect(ids).toEqual(["docs-h-a", "docs-h-a-1", "docs-h-a-2"]);
  });

  it("applies an id prefix to headings and same-note links, and ignores bad prefixes", () => {
    const md = "# Lore\n\n[[#Lore]] [up](#Lore)";
    const body = render(md, { idPrefix: "n2-" });
    expect(body.querySelector("h1").id).toBe("docs-h-n2-lore");
    expect(
      Array.from(body.querySelectorAll("a")).map((a) => a.getAttribute("href")),
    ).toEqual(["#docs-h-n2-lore", "#docs-h-n2-lore"]);
    // Survives the sanitizer's id rule
    expect(
      parse(
        sanitizeHtml(renderObsidianMarkdown(md, { idPrefix: "n2-" })),
      ).querySelector("h1").id,
    ).toBe("docs-h-n2-lore");
    for (const bad of ['x" onmouseover="a', "UPPER", "a b", 7, null]) {
      expect(render(md, { idPrefix: bad }).querySelector("h1").id).toBe(
        "docs-h-lore",
      );
    }
  });

  it("strips leading YAML frontmatter only when it is closed", () => {
    expect(
      render("---\ntags: [a]\ntitle: x\n---\n# Title").textContent.trim(),
    ).toBe("Title");
    expect(render("---\nnot closed").querySelector("hr")).not.toBeNull();
  });
});

describe("renderObsidianMarkdown: links and images", () => {
  it("sends relative markdown links through the doc index", () => {
    const body = render(
      "[sword](Faithkeeper.md) [dialog](../Developer%20Notes/SystemDialog/Dialog%20System.md) [x](missing.md)",
    );
    const links = body.querySelectorAll("a[data-doc-link]");
    expect(links[0].dataset.docLink).toBe(
      `${SB}/Worldbuilding/Object & Artifacts/Faithkeeper.md`,
    );
    expect(links[1].dataset.docLink).toBe(
      `${SB}/Developer Notes/SystemDialog/Dialog System.md`,
    );
    expect(body.querySelector(".docs-unresolved-link").textContent).toBe("x");
  });

  it("opens external links in a new tab", () => {
    const a = render(
      "[site](https://example.com/a) <https://x.y> mail@example.com",
    ).querySelectorAll("a");
    expect(a[0].getAttribute("href")).toBe("https://example.com/a");
    expect(a[0].getAttribute("target")).toBe("_blank");
    expect(a[0].getAttribute("rel")).toBe("noopener noreferrer");
    expect(a[1].getAttribute("href")).toBe("https://x.y");
    expect(a[2].getAttribute("href")).toBe("mailto:mail@example.com");
  });

  it("turns relative markdown images into embeds, decoding the path", () => {
    const body = render(
      "![a pic](Attachments/My%20Pic.png) ![b](%23ClairLineArt.jpg?raw=1#frag)",
    );
    const [a, b] = body.querySelectorAll("img.docs-embed-image");
    expect(a.dataset.embedTarget).toBe("Attachments/My Pic.png");
    expect(a.getAttribute("alt")).toBe("a pic");
    expect(a.hasAttribute("data-embed-literal")).toBe(false);
    expect(b.dataset.embedTarget).toBe("#ClairLineArt.jpg");
    expect(b.dataset.embedLiteral).toBe("true");
  });

  it("never points <img src> at a relative URL", () => {
    for (const md of [
      "![frag](#ClairLineArt.jpg)",
      "![query](?x=1)",
      "![both](#a?b)",
    ]) {
      const body = render(md);
      expect(body.querySelector("img")).toBeNull();
      expect(body.textContent.trim()).toBe(md.slice(2, md.indexOf("]")));
    }
  });

  it("treats protocol-relative images as remote", () => {
    const md = "![r](//example.com/r.png)";
    expect(render(md).querySelector("img").getAttribute("src")).toBe(
      "//example.com/r.png",
    );
    const off = render(md, { allowRemoteImages: false });
    expect(off.querySelector("img")).toBeNull();
    expect(off.querySelector("a").getAttribute("href")).toBe(
      "//example.com/r.png",
    );
  });

  it("routes GFM autolinks and reference links through the link renderer", () => {
    const body = render(
      "www.example.com and https://x.y/a_b and <mailto:a@b.c>\n\n[ref][r] ![img][i]\n\n" +
        "[r]: https://x.y/ref 'T'\n[i]: https://x.y/i.png",
    );
    const hrefs = Array.from(body.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toEqual([
      "http://www.example.com",
      "https://x.y/a_b",
      "mailto:a@b.c",
      "https://x.y/ref",
    ]);
    for (const a of body.querySelectorAll("a")) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    }
    expect(
      body.querySelector('a[href="https://x.y/ref"]').getAttribute("title"),
    ).toBe("T");
    expect(body.querySelector("img").getAttribute("src")).toBe(
      "https://x.y/i.png",
    );
  });

  it("drops relative images when there is no current doc", () => {
    const body = parse(
      renderObsidianMarkdown("![alt text](a.png)", { wiki: false }),
    );
    expect(body.querySelector("img")).toBeNull();
    expect(body.textContent.trim()).toBe("alt text");
  });

  it("keeps data: images and remote images unless remote images are off", () => {
    const md =
      "![d](data:image/png;base64,iVBORw0KGgo=) ![r](https://example.com/r.png)";
    const on = render(md).querySelectorAll("img");
    expect(on[0].getAttribute("src")).toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
    expect(on[1].getAttribute("src")).toBe("https://example.com/r.png");

    const off = render(md, { allowRemoteImages: false });
    expect(off.querySelectorAll("img")).toHaveLength(1);
    const link = off.querySelector("a");
    expect(link.getAttribute("href")).toBe("https://example.com/r.png");
    expect(link.textContent).toBe("r");
  });

  it("escapes raw HTML when it is not allowed", () => {
    const body = render("<b>bold</b>\n\n<div onclick='x()'>block</div>", {
      allowRawHtml: false,
    });
    expect(body.querySelector("b, div")).toBeNull();
    expect(body.textContent).toContain("<b>bold</b>");
    expect(body.textContent).toContain("<div onclick='x()'>block</div>");
  });

  it("passes raw HTML through when allowed (sanitizer's job)", () => {
    expect(render("<b>bold</b>").querySelector("b").textContent).toBe("bold");
  });
});

describe("renderObsidianMarkdown: security fixtures", () => {
  const FIXTURES = [
    '![x" onerror=alert(1) y="](a.png)',
    '![x" onerror=alert(1) y="](https://example.com/a.png)',
    "[a](java&#x09;script:alert(1))",
    "[a](&#106;avascript:alert(1))",
    "[a](javascript:alert(1))",
    "[a](JAVASCRIPT:alert(1) 'title')",
    "<javascript:alert(1)>",
    "[a][x]\n\n[x]: javascript:alert(1)",
    "![a][x]\n\n[x]: javascript:alert(1)",
    "[a]\n\n[a]: <javascript:alert(1)>",
    "[a](<javascript:alert(1)>)",
    "[a](javascript\\:alert(1))",
    "[a](vbscript:msgbox(1))",
    "![a](javascript:alert(1))",
    "![a](blob:https://paradise/1)",
    "![a](//evil.example/x.png)",
    "![a](data:text/html;base64,PHNjcmlwdD4=)",
    "[a](data:text/html,<script>alert(1)</script>)",
    '[a](https://x.y "t\\" onmouseover=\\"alert(1)")',
    '[[x" onmouseover="alert(1)]]',
    '![[x" onerror="alert(1).png]]',
    "#tag<img/src=x/onerror=alert(1)>",
    "<pre>\n<img/src=x onerror=alert(1)>\n</pre>",
    "a <code>x <img/src=x onerror=alert(1)></code>",
    "<img src=x onerror=alert(1)>",
    "<svg onload=alert(1)>",
    "<a href='javascript:alert(1)'>x</a>",
  ];

  for (const allowRawHtml of [true, false]) {
    describe(`allowRawHtml: ${allowRawHtml}`, () => {
      for (const md of FIXTURES) {
        it(`neutralises ${JSON.stringify(md)}`, () => {
          const raw = renderObsidianMarkdown(md, {
            currentPath: AMIRA_PATH,
            index: INDEX,
            allowRawHtml,
          });
          if (!allowRawHtml) expectInert(parse(raw));
          const clean = sanitizeHtml(raw);
          expectInert(parse(clean));
          expectInert(parse(parse(clean).innerHTML));
        });
      }
    });
  }

  it("keeps the hostile alt text as an attribute value", () => {
    const img = render('![x" onerror=alert(1) y="](a.png)').querySelector(
      "img",
    );
    expect(img.getAttribute("alt")).toBe('x" onerror=alert(1) y="');
    expect(img.hasAttribute("onerror")).toBe(false);
  });

  it("renders unsafe links as plain text", () => {
    for (const md of [
      "[a](java&#x09;script:alert(1))",
      "[a](&#106;avascript:alert(1))",
      "[a][x]\n\n[x]: javascript:alert(1)",
    ]) {
      const body = render(md);
      expect(body.querySelector("a")).toBeNull();
      expect(body.textContent.trim()).toBe("a");
    }
  });
});

describe("renderObsidianMarkdown: long paragraphs stay fast", () => {
  // Drive previews render untrusted files on the main thread. Each input is one
  // paragraph with tens of thousands of inline tokens; before the fixes these
  // took 3-55 s (quadratic walkTokens, start() re-scanning the rest of the
  // paragraph per token, reading a growing merged text token), now ~0.1-0.2 s.
  const DRIVE = { allowRawHtml: false, wiki: false, allowRemoteImages: false };
  const LIMIT_MS = 1500;

  const timed = (markdown, options) => {
    const start = performance.now();
    const html = renderObsidianMarkdown(markdown, options);
    return { html, ms: performance.now() - start };
  };

  it.each([
    ["emphasis", "*a* ", 64_000, DRIVE],
    ["'#' that never starts a tag", "*a*#b ", 43_000, DRIVE],
    ["single '='", "*a*=b ", 43_000, DRIVE],
    ["'#1' tags that fail to match", "a #1 ", 60_000, DRIVE],
    ["single '['", "*a*[b ", 43_000, {}],
    ["'![' without a second '['", "*a*![b ", 37_000, {}],
  ])("renders ~256 KB of %s quickly", (_name, unit, count, options) => {
    const { html, ms } = timed(unit.repeat(count), options);
    expect(html.length).toBeGreaterThan(unit.length * count);
    expect(ms).toBeLessThan(LIMIT_MS);
  });

  it("still finds tags and highlights far into a long paragraph", () => {
    const md =
      "*a* ".repeat(3000) +
      "#first ==mid== " +
      "*b*#no ".repeat(2000) +
      "#second x=y ==end==";
    const body = parse(renderObsidianMarkdown(md, DRIVE));
    expect(Array.from(body.querySelectorAll(".docs-tag"), (t) => t.textContent)).toEqual([
      "#first",
      "#second",
    ]);
    expect(Array.from(body.querySelectorAll("mark"), (m) => m.textContent)).toEqual([
      "mid",
      "end",
    ]);
    expect(body.querySelectorAll("em")).toHaveLength(5000);
  });

  it("still escapes text inside raw <pre>/<code> when raw HTML is off", () => {
    const md =
      "<pre>\n<img src=x onerror=alert(1)>\n</pre>\n\n| a |\n|---|\n| <code><b>x</b></code> |";
    const body = parse(renderObsidianMarkdown(md, DRIVE));
    expect(body.querySelector("img, b")).toBeNull();
    expect(body.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(body.querySelector("td").textContent).toContain("<b>x</b>");
  });
});

describe("renderObsidianMarkdown: properties", () => {
  const fragment = fc.constantFrom(
    "[",
    "]",
    "(",
    ")",
    "!",
    "<",
    ">",
    '"',
    "'",
    "`",
    "*",
    "_",
    "#",
    "|",
    "=",
    "==",
    "[[",
    "]]",
    "![[",
    " ",
    "\n",
    "\n\n",
    "javascript:",
    "java\tscript:",
    "&#106;",
    "&#x09;",
    "&colon;",
    "onerror=",
    "onload=",
    "alert(1)",
    "a.png",
    "x.pdf",
    "https://x.y/",
    "data:image/png;base64,AA",
    "data:text/html,",
    "<img ",
    "<a href=",
    "<svg ",
    "<script>",
    "<pre>",
    "</pre>",
    "tag",
    "Faithkeeper",
    "---",
    "> ",
    "- ",
    "| a | b |\n|---|---|\n",
    "    ",
    "\\",
  );
  const markdown = fc.oneof(
    fc.array(fragment, { maxLength: 40 }).map((parts) => parts.join("")),
    fc.string({ maxLength: 200 }),
  );

  it("never throws and never emits handlers or script URLs", () => {
    fc.assert(
      fc.property(
        markdown,
        fc.boolean(),
        fc.boolean(),
        (md, allowRawHtml, wiki) => {
          const raw = renderObsidianMarkdown(md, {
            currentPath: AMIRA_PATH,
            index: INDEX,
            allowRawHtml,
            wiki,
          });
          expect(typeof raw).toBe("string");
          if (!allowRawHtml) expectInert(parse(raw));
          expectInert(parse(sanitizeHtml(raw)));
        },
      ),
      { numRuns: 400 },
    );
  });

  it("never throws without an index or current path", () => {
    fc.assert(
      fc.property(markdown, (md) => {
        expect(typeof renderObsidianMarkdown(md)).toBe("string");
      }),
      { numRuns: 200 },
    );
  });
});
