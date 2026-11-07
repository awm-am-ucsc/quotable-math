import { HtmlBasePlugin } from "@11ty/eleventy";

export default function (eleventyConfig) {
  // Rewrites root-relative links (/speakers/...) to include the /quotable-math/ prefix.
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPassthroughCopy("src/assets");
  // Proves ownership of the site to Google Search Console. Keep this file.
  eleventyConfig.addPassthroughCopy("src/googleeb8106a1a4a26505.html");

  eleventyConfig.addFilter("truncate", (str, n = 155) =>
    str.length <= n ? str : str.slice(0, n - 1).replace(/\s+\S*$/, "") + "…",
  );
  eleventyConfig.addFilter("json", (value) => JSON.stringify(value).replace(/</g, "\\u003c"));
  eleventyConfig.addFilter("isoDate", (date) => date.toISOString().slice(0, 10));
}

export const config = {
  dir: { input: "src", output: "_site" },
  pathPrefix: process.env.PATH_PREFIX ?? "/quotable-math/",
  templateFormats: ["njk", "md"],
  markdownTemplateEngine: "njk",
  htmlTemplateEngine: "njk",
};
