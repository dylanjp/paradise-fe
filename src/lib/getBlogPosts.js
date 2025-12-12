import fs from "fs";
import path from "path";

const postsDir = path.join(process.cwd(), "public", "blogs");

export function getBlogPosts() {
  if (!fs.existsSync(postsDir)) {
    console.warn(`⚠️ Blog folder not found at: ${postsDir}`);
    return [];
  }

  const filenames = fs.readdirSync(postsDir);

  return filenames
    .filter((filename) => filename.endsWith(".md"))
    .map((filename) => {
      const slug = filename.replace(/\.md$/, "");
      const filePath = path.join(postsDir, filename);
      const fileContent = fs.readFileSync(filePath, "utf8");

      // Get title (first line starting with #)
      const match = fileContent.match(/^#\s+(.*)/m);
      const title = match ? match[1] : slug;

      return {
        slug,
        title,
      };
    });
}

export function getPostBySlug(slug) {
  const fullPath = path.join(postsDir, `${slug}.md`);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Blog post not found: ${slug}`);
  }

  const content = fs.readFileSync(fullPath, "utf8");
  return content;
}
