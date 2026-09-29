/**
 * Tests for the URL allowlist and the HTML sanitizer.
 *
 * Rendered docs and Drive markdown are treated as hostile (the JWT lives in
 * localStorage), so these cover the classic XSS / mXSS vectors, and check the
 * output again after a second parse, the way the browser will see it.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import fc from "fast-check";
import { safeUrl, isRelativeUrl, decodeHtmlEntities } from "../safeUrl";
import { sanitizeHtml } from "../sanitizeHtml";

/** Parses HTML into a detached, inert document body */
function parse(html) {
  return new DOMParser().parseFromString(html, "text/html").body;
}

/**
 * True when an attribute URL (as the browser sees it) uses a script-capable or
 * local scheme. Whitespace/control characters are removed first, like the URL parser.
 */
function isDangerousUrl(value) {
  const v = String(value)
    .replace(/[\u0000-\u0020\u007f]/g, "")
    .toLowerCase();
  return (
    /^(javascript|vbscript|livescript|blob|file):/.test(v) ||
    /^data:(?!image\/)/.test(v)
  );
}

// prettier-ignore
const FORBIDDEN_TAGS = [
  "script", "style", "iframe", "object", "embed", "svg", "math", "form",
  "textarea", "select", "noscript", "template", "base", "meta", "link",
  "frame", "frameset", "animate", "set",
];

/** Asserts that a sanitized fragment is inert, including after re-parsing it */
function expectInert(html) {
  for (const body of [parse(html), parse(parse(html).innerHTML)]) {
    for (const el of body.querySelectorAll("*")) {
      expect(FORBIDDEN_TAGS).not.toContain(el.localName);
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name.startsWith("on")).toBe(false);
        expect([
          "style",
          "srcset",
          "formaction",
          "action",
          "xlink:href",
        ]).not.toContain(attr.name);
        if (attr.name === "href" || attr.name === "src") {
          expect(isDangerousUrl(attr.value)).toBe(false);
        }
      }
    }
  }
}

describe("decodeHtmlEntities", () => {
  it("decodes numeric, hex and named references", () => {
    expect(decodeHtmlEntities("&#106;&#x61;&#X76;a")).toBe("java");
    expect(decodeHtmlEntities("a&colon;b&Tab;c&NewLine;d")).toBe("a:b\tc\nd");
    expect(decodeHtmlEntities("&amp;&lt;&gt;&quot;&apos;")).toBe("&<>\"'");
    expect(decodeHtmlEntities("&#106avascript")).toBe("javascript");
    expect(decodeHtmlEntities("&unknown; &#0; &#x110000;")).toBe(
      "&unknown; \ufffd \ufffd",
    );
  });
});

describe("safeUrl", () => {
  it("allows http(s), mailto, tel, relative URLs and fragments for links", () => {
    expect(safeUrl("https://example.com/a?b=1")).toBe(
      "https://example.com/a?b=1",
    );
    expect(safeUrl("  http://x.y  ")).toBe("http://x.y");
    expect(safeUrl("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(safeUrl("tel:+15555550100")).toBe("tel:+15555550100");
    expect(safeUrl("Folder/Note.md")).toBe("Folder/Note.md");
    expect(safeUrl("../x.png")).toBe("../x.png");
    expect(safeUrl("#heading")).toBe("#heading");
  });

  it("rejects script-capable and local schemes, including obfuscated ones", () => {
    const bad = [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      " javascript:alert(1)",
      "\u0001javascript:alert(1)",
      "java\tscript:alert(1)",
      "java\nscript:alert(1)",
      "java&#x09;script:alert(1)",
      "&#106;avascript:alert(1)",
      "&#x6A;avascript:alert(1)",
      "javascript&colon;alert(1)",
      "vbscript:msgbox(1)",
      "data:text/html,<script>alert(1)</script>",
      "blob:https://paradise/1234",
      "file:///C:/Windows/win.ini",
      "",
      "   ",
      null,
      undefined,
      42,
    ];
    for (const url of bad) {
      expect(safeUrl(url)).toBeNull();
      expect(safeUrl(url, { img: true })).toBeNull();
    }
  });

  it("allows image data: URLs only for images", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(safeUrl(png, { img: true })).toBe(png);
    expect(safeUrl("data:image/svg+xml,<svg/>", { img: true })).not.toBeNull();
    expect(
      safeUrl("DATA:IMAGE/JPEG;base64,AAAA", { img: true }),
    ).not.toBeNull();
    expect(safeUrl(png)).toBeNull();
    expect(safeUrl("data:image/x-icon;base64,AAAA", { img: true })).toBeNull();
    expect(safeUrl("mailto:a@b.c", { img: true })).toBeNull();
  });

  it("detects relative URLs", () => {
    expect(isRelativeUrl("Attachments/a.png")).toBe(true);
    expect(isRelativeUrl("/abs/a.png")).toBe(true);
    expect(isRelativeUrl("My%20Note.md")).toBe(true);
    expect(isRelativeUrl("https://x.y/a.png")).toBe(false);
    expect(isRelativeUrl("//x.y/a.png")).toBe(false);
    expect(isRelativeUrl("https://rel.invalid/a")).toBe(false);
    expect(isRelativeUrl("javascript:alert(1)")).toBe(false);
    expect(isRelativeUrl("")).toBe(false);
  });
});

describe("sanitizeHtml", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty string when DOMParser is unavailable (SSR/build)", () => {
    vi.stubGlobal("DOMParser", undefined);
    expect(sanitizeHtml("<p>hi</p>")).toBe("");
  });

  it("keeps ordinary markdown output intact", () => {
    const html =
      '<h2 id="docs-h-intro">Intro</h2><p><em>a</em> <strong>b</strong> <del>c</del> <mark>d</mark>' +
      "<code>e</code></p><pre><code>f</code></pre><blockquote><p>g</p></blockquote>" +
      '<ol start="3"><li>h</li></ol><hr><p>x<sup>2</sup>H<sub>2</sub>O</p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("removes script and style elements with their content", () => {
    const out = sanitizeHtml(
      "<p>a</p><script>alert(1)</script><style>p{}</style>",
    );
    expect(out).toBe("<p>a</p>");
  });

  it("strips event handler attributes", () => {
    const out = sanitizeHtml(
      '<img src="a.png" onerror="alert(1)"><p onclick="x()" onmouseover=y>t</p>',
    );
    expect(out).not.toMatch(/onerror|onclick|onmouseover/);
    expect(parse(out).querySelector("img").getAttribute("src")).toBe("a.png");
    expectInert(out);
  });

  it("drops javascript: links and their whitespace/entity variants", () => {
    const vectors = [
      '<a href="javascript:alert(1)">x</a>',
      '<a href="JaVaScRiPt:alert(1)">x</a>',
      '<a href=" javascript:alert(1)">x</a>',
      '<a href="java&#x09;script:alert(1)">x</a>',
      '<a href="java&#x0A;script:alert(1)">x</a>',
      '<a href="&#106;avascript:alert(1)">x</a>',
      '<a href="&amp;#106;avascript:alert(1)">x</a>',
      '<a href="javascript&colon;alert(1)">x</a>',
      '<a href="&#x01;javascript:alert(1)">x</a>',
      '<a href="vbscript:msgbox(1)">x</a>',
      '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
    ];
    for (const html of vectors) {
      const out = sanitizeHtml(html);
      expect(parse(out).querySelector("a").hasAttribute("href")).toBe(false);
      expect(parse(out).textContent).toBe("x");
      expectInert(out);
    }
  });

  it("removes svg, xlink and animate vectors", () => {
    const out = sanitizeHtml(
      '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a>' +
        '<animate attributeName="href" values="javascript:alert(1)"/></svg>' +
        '<math><mi xlink:href="javascript:alert(1)">m</mi></math><p>ok</p>',
    );
    expect(out).toBe("<p>ok</p>");
  });

  it("neutralises the noscript mXSS vector", () => {
    // Leading position: the scripting-disabled parser puts <noscript> in <head>
    const leading = sanitizeHtml(
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript><p>after</p>',
    );
    expect(parse(leading).querySelector("img")).toBeNull();
    expect(leading).not.toMatch(/title|onerror/);
    expectInert(leading);

    // Inside body: <noscript> is dropped together with its content
    const inBody = sanitizeHtml(
      '<div><noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript></div><p>after</p>',
    );
    expect(inBody).toBe("<div></div><p>after</p>");
    expectInert(inBody);
  });

  it("drops srcset, style and blob: URLs", () => {
    const out = sanitizeHtml(
      '<img src="a.png" srcset="javascript:alert(1) 1x"><p style="background:url(javascript:alert(1))">s</p>' +
        '<img src="blob:https://paradise/123"><a href="blob:https://paradise/123">b</a>',
    );
    expect(out).not.toMatch(/srcset|style|blob:/);
    expectInert(out);
  });

  it("only keeps docs heading ids", () => {
    const out = sanitizeHtml(
      '<h1 id="login">a</h1><h2 id="docs-h-ok-1">b</h2><h3 id="docs-h-Bad">c</h3>',
    );
    const body = parse(out);
    expect(body.querySelector("h1").hasAttribute("id")).toBe(false);
    expect(body.querySelector("h2").id).toBe("docs-h-ok-1");
    expect(body.querySelector("h3").hasAttribute("id")).toBe(false);
  });

  it("keeps GitHub-style heading ids with Unicode letters, '_' and '--'", () => {
    const body = parse(
      sanitizeHtml(
        '<h1 id="docs-h-über_uns">a</h1><h2 id="docs-h--verification--dont-skip">b</h2>' +
          '<h3 id="docs-h-日本語">c</h3><h4 id="docs-h-a b">d</h4><h5 id="docs-h-a&quot;]x">e</h5>' +
          '<h6 id="docs-h-">f</h6>',
      ),
    );
    expect(Array.from(body.querySelectorAll("h1,h2,h3,h4,h5,h6"), (h) => h.id)).toEqual([
      "docs-h-über_uns",
      "docs-h--verification--dont-skip",
      "docs-h-日本語",
      "",
      "",
      "",
    ]);
  });

  it("keeps image data: URLs but not other data: URLs", () => {
    const out = sanitizeHtml(
      '<img src="data:image/png;base64,iVBORw0KGgo="><img src="data:text/html,<script>alert(1)</script>">',
    );
    const imgs = parse(out).querySelectorAll("img");
    expect(imgs[0].getAttribute("src")).toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
    expect(imgs[1].hasAttribute("src")).toBe(false);
  });

  it("keeps the named data-* attributes and drops others", () => {
    const html =
      '<a href="#" class="docs-internal-link" data-doc-link="LE Docs/A.md" data-x="1">a</a>' +
      '<img class="docs-embed-image" data-embed-target="a.png" data-embed-from="n.md" data-embed-literal="true" alt="a">' +
      '<div class="docs-embed-pdf" data-embed-pdf="x.pdf" data-embed-from="n.md"></div>' +
      '<div class="docs-embed-note" data-embed-note="LE Docs/B.md" data-evil="y"></div>';
    const body = parse(sanitizeHtml(html));
    expect(body.querySelector("a").dataset.docLink).toBe("LE Docs/A.md");
    expect(body.querySelector("a").hasAttribute("data-x")).toBe(false);
    const img = body.querySelector("img");
    expect(img.dataset.embedTarget).toBe("a.png");
    expect(img.dataset.embedFrom).toBe("n.md");
    expect(img.dataset.embedLiteral).toBe("true");
    expect(body.querySelector(".docs-embed-pdf").dataset.embedPdf).toBe(
      "x.pdf",
    );
    const note = body.querySelector(".docs-embed-note");
    expect(note.dataset.embedNote).toBe("LE Docs/B.md");
    expect(note.hasAttribute("data-evil")).toBe(false);
  });

  it("keeps table alignment", () => {
    const out = sanitizeHtml(
      '<table><thead><tr><th align="left">a</th><th align="right" colspan="2">b</th></tr></thead>' +
        '<tbody><tr><td align="center">1</td><td align="evil">2</td></tr></tbody></table>',
    );
    const body = parse(out);
    expect(body.querySelector("th").getAttribute("align")).toBe("left");
    expect(body.querySelectorAll("th")[1].getAttribute("colspan")).toBe("2");
    expect(body.querySelector("td").getAttribute("align")).toBe("center");
    expect(body.querySelectorAll("td")[1].hasAttribute("align")).toBe(false);
  });

  it("forces rel when target=_blank and drops other targets", () => {
    const body = parse(
      sanitizeHtml(
        '<a href="https://x.y" target="_blank">a</a><a href="https://x.y" target="_top" rel="opener">b</a>',
      ),
    );
    const [a, b] = body.querySelectorAll("a");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    expect(b.hasAttribute("target")).toBe(false);
    expect(b.hasAttribute("rel")).toBe(false);
  });

  it("keeps disabled task checkboxes and removes other inputs", () => {
    const body = parse(
      sanitizeHtml(
        '<ul><li><input type="checkbox" checked onclick="x()"> done</li></ul>' +
          '<input type="text" value="x"><input type="image" src="javascript:alert(1)">',
      ),
    );
    const inputs = body.querySelectorAll("input");
    expect(inputs).toHaveLength(1);
    expect(inputs[0].getAttribute("type")).toBe("checkbox");
    expect(inputs[0].hasAttribute("disabled")).toBe(true);
    expect(inputs[0].hasAttribute("checked")).toBe(true);
    expect(inputs[0].hasAttribute("onclick")).toBe(false);
  });

  it("unwraps unknown elements but keeps their text; drops dangerous containers", () => {
    const out = sanitizeHtml(
      "<custom-el>hi <b>bold</b> <u>u</u></custom-el><details><summary>s</summary>d</details>" +
        '<iframe src="https://x.y">f</iframe><object data="x">o</object><embed src="x">' +
        '<form action="javascript:alert(1)"><button formaction="javascript:alert(1)">b</button></form>' +
        "<textarea>t</textarea><select><option>o</option></select><!-- comment --><template><p>t</p></template>",
    );
    expect(out).toBe("hi bold usd");
  });

  it("drops template content even inside allowed elements", () => {
    const out = sanitizeHtml(
      "<p>a<template><img src=x onerror=alert(1)><p>t</p></template>b</p>",
    );
    expect(out).toBe("<p>ab</p>");
  });

  it("drops svg/math namespace-confusion (style) mXSS vectors", () => {
    const vectors = [
      "<svg><style><img src=x onerror=alert(1)></style></svg>",
      "<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>",
      '<math><mtext><h1><a><h6></a></h6><mglyph><svg><mtext><style><a title="</style><img src onerror=alert(1)>">',
      '<svg></p><style><a id="</style><img src=1 onerror=alert(1)>">',
      "<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>",
      "<svg><animate attributeName=href values=javascript:alert(1) /><a><text>x</text></a></svg>",
      "<svg><set attributeName=onmouseover to=alert(1) /></svg>",
      "<svg><use href=\"data:image/svg+xml,<svg id='x' xmlns='http://www.w3.org/2000/svg'><image href='1' onerror='alert(1)'/></svg>#x\" /></svg>",
    ];
    for (const html of vectors) {
      const out = sanitizeHtml(html);
      expect(out).not.toMatch(/onerror|onmouseover|javascript:/i);
      expectInert(out);
    }
  });

  it("validates img src with image rules", () => {
    const body = parse(
      sanitizeHtml(
        '<img src="javascript:alert(1)"><img src=" blob:https://paradise/1"><img src="data:text/html,x">' +
          '<img src="data:image/svg+xml,%3Csvg%2F%3E"><img src="https://x.y/a.png"><img src="Attachments/a.png">',
      ),
    );
    const srcs = Array.from(body.querySelectorAll("img")).map((i) =>
      i.getAttribute("src"),
    );
    expect(srcs).toEqual([
      null,
      null,
      null,
      "data:image/svg+xml,%3Csvg%2F%3E",
      "https://x.y/a.png",
      "Attachments/a.png",
    ]);
  });

  it("normalizes target=_BLANK and drops name, form and bad dimensions", () => {
    const body = parse(
      sanitizeHtml(
        '<a href="https://x.y" target="_BLANK" name="login" rel="opener">a</a>' +
          '<img src="a.png" width="99999999" height="12" name="x" usemap="#m">' +
          '<input type="checkbox" form="f" name="n" value="v">',
      ),
    );
    const a = body.querySelector("a");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    expect(a.hasAttribute("name")).toBe(false);
    const img = body.querySelector("img");
    expect(img.hasAttribute("width")).toBe(false);
    expect(img.getAttribute("height")).toBe("12");
    expect(img.hasAttribute("name")).toBe(false);
    expect(img.hasAttribute("usemap")).toBe(false);
    const input = body.querySelector("input");
    expect(
      Array.from(input.attributes)
        .map((x) => x.name)
        .sort(),
    ).toEqual(["disabled", "type"]);
  });

  it("keeps data-* values byte for byte (they become fetch parameters)", () => {
    const target = `Attachments/Amira & "Co" <1>/#ClairLineArt.jpg`;
    const html = `<img class="docs-embed-image" data-embed-target="${target
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")}" data-embed-from="LE Docs/A.md">`;
    const img = parse(sanitizeHtml(html)).querySelector("img");
    expect(img.dataset.embedTarget).toBe(target);
  });

  it("drops srcset/source inside picture and audio/video wrappers", () => {
    const out = sanitizeHtml(
      '<picture><source srcset="javascript:alert(1)"><img src="a.png"></picture>' +
        '<video src="javascript:alert(1)" poster="javascript:alert(1)"><source src="x.mp4"></video>',
    );
    expect(out).toBe('<img src="a.png">');
  });

  it("strips base, meta and link elements", () => {
    const out = sanitizeHtml(
      '<base href="javascript:alert(1)//"><meta http-equiv="refresh" content="0;url=javascript:alert(1)">' +
        '<link rel="stylesheet" href="https://evil/x.css"><p>t</p>',
    );
    expect(out).toBe("<p>t</p>");
  });

  it("handles deeply nested input without overflowing the stack", () => {
    // The walk itself is iterative; the depth stays below jsdom's recursive
    // serializer limit (browsers cap parser nesting at a few hundred anyway).
    const depth = 1500;
    const start = Date.now();
    const html = "<div>".repeat(depth) + "x" + "</div>".repeat(depth);
    expect(() => sanitizeHtml(html)).not.toThrow();
    const unknown = "<x-a>".repeat(depth) + "y" + "</x-a>".repeat(depth);
    expect(sanitizeHtml(unknown)).toBe("y");
    expect(Date.now() - start).toBeLessThan(4000);
  });

  it("never emits handlers, dangerous URLs or forbidden elements (property)", () => {
    const fragment = fc.constantFrom(
      "<img src=x onerror=alert(1)>",
      "<a href='javascript:alert(1)'>",
      '<a href="java&#x09;script:1">',
      "<svg onload=alert(1)>",
      "<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>",
      "<noscript><p title='</noscript><img src=x onerror=alert(1)>'>",
      "<style>",
      "</style>",
      "<script>",
      "</script>",
      "<iframe srcdoc='<script>alert(1)</script>'>",
      "<template>",
      "<textarea>",
      "</textarea>",
      "<table>",
      "<tr>",
      "<td>",
      "<p>",
      "</p>",
      "<div>",
      "</div>",
      "<!--",
      "-->",
      "<![CDATA[",
      "]]>",
      "<",
      ">",
      '"',
      "'",
      "=",
      "x",
      " ",
      "&lt;",
      "&#106;",
      "data:text/html,",
      "blob:x",
      "<input type=checkbox onfocus=alert(1) autofocus>",
      "<img srcset='x 1x' src=a.png>",
      "<a target=_blank href=https://x.y>",
      "<base href=javascript:alert(1)//>",
    );
    fc.assert(
      fc.property(
        fc.array(fragment, { maxLength: 30 }),
        fc.string(),
        (parts, noise) => {
          const out = sanitizeHtml(parts.join("") + noise);
          expectInert(out);
        },
      ),
      { numRuns: 300 },
    );
  });
});
