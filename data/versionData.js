// versionData.js

const versionData = [
  {
    version: "v1.0.4",
    releaseDate: "2026-11-21",
    notes: [
      "NEW: Documentation — reads the consolidated Obsidian vault: Home and Family for everyone, Dylan Personal and LLCs for admins only",
      "NEW: Documentation — links between notes work across sections",
      "BUG FIX: PDFs display on phones and tablets (Documentation, Pratt Drive and PDFs inside notes) instead of \"Preview not supported\", with zoom buttons",
      "SECURITY: Next.js and build tools updated to patched versions",
      "BUG FIX: Admin — the enable/disable toggle works, so disabled users can be re-enabled",
      "BUG FIX: Admin — disabling a user signs them out right away instead of when their login expires",
      "BUG FIX: Health Journal — saving on a date that already has an entry updates that entry",
      "BUG FIX: Health — the browser no longer blocks appointment and reminder updates (groundwork for editing them)",
      "BUG FIX: Pratt Drive — correct error messages, and the folder refreshes when an item no longer exists",
      "BUG FIX: Notifications — a TODO created from a notification lands in your own task list, with clear messages when it already exists or has expired",
    ],
  },
  {
    version: "v1.0.3",
    releaseDate: "2026-09-28",
    notes: [
      "NEW: Health Portal — upload HSA receipts to the Admin Drive (admins only)",
      "NEW: Forgejo shortcut in the navbar",
      "NEW: Documentation — LE Docs and Pratt Capitol Obsidian vaults (admins only)",
      "NEW: Documentation — preview PDFs, images, and Obsidian canvas boards",
      "NEW: Documentation — embedded images and notes, wiki links, and #tags",
      "NEW: Documentation — refresh button to pick up new notes",
      "NEW: Pratt Drive — preview PDFs, images, documents, and media without downloading",
    ],
  },
  {
    version: "v1.0.2",
    releaseDate: "2026-06-29",
    notes: [
      "NEW: Health Graphs — edit and delete metrics",
      "NEW: Health Graphs — edit and delete individual data points",
      "NEW: Health Graphs — editable data points list under each chart",
      "BUG FIX: Document upload reliability and date handling",
      "BUG FIX: MyDrive mobile context menu and popover positioning",
    ],
  },
  {
    version: "v1.0.1",
    releaseDate: "2026-03-08",
    notes: ["BUG FIX: MyDrive Options",
            "BUG FIX: Health Graphs sorting"
    ],
  },
  {
    version: "v1.0",
    releaseDate: "2026-03-08",
    notes: ["Full Release"],
  },
];

export default versionData;
