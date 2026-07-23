// Converts pasted rich text (HTML) into clean, MarkText-ready GitHub-Flavored Markdown.
// Used by the note editor's onPaste handler so content copied from ChatGPT / Claude /
// Gemini keeps its formatting (headings, bold, lists, tables, code blocks) instead of
// pasting as flat plain text.
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

let _service = null;

function getService() {
  if (_service) return _service;
  const td = new TurndownService({
    headingStyle: "atx",          // # H1  ## H2   (MarkText-friendly)
    hr: "---",
    bulletListMarker: "-",        // always "-" bullets
    codeBlockStyle: "fenced",     // ```lang fences, never 4-space indent
    fence: "```",
    emDelimiter: "*",             // *italic*
    strongDelimiter: "**",        // **bold**
    linkStyle: "inlined",
  });

  // GFM: tables, strikethrough, task lists
  td.use(gfm);

  // Keep fenced code language when the source marks it (e.g. class="language-python")
  td.addRule("fencedCodeWithLang", {
    filter: (node) =>
      node.nodeName === "PRE" &&
      node.firstChild &&
      node.firstChild.nodeName === "CODE",
    replacement: (_content, node) => {
      const code = node.firstChild;
      const className = code.getAttribute("class") || "";
      const langMatch = className.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : "";
      const text = code.textContent.replace(/\n$/, "");
      return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
    },
  });

  _service = td;
  return td;
}

// Normalise whitespace so MarkText renders correctly:
// collapse 3+ blank lines to one, trim trailing spaces, ensure single trailing newline.
function tidy(md) {
  return md
    .replace(/ /g, " ")          // non-breaking spaces -> normal
    .replace(/^(\s*)-\s{2,}/gm, "$1- ")          // "-   item" -> "- item"
    .replace(/^(\s*)(\d+)\.\s{2,}/gm, "$1$2. ")  // "1.   item" -> "1. item"
    .replace(/[ \t]+$/gm, "")         // trailing whitespace per line
    .replace(/\n{3,}/g, "\n\n")       // max one blank line
    .replace(/^\n+/, "")              // no leading blank lines
    .trimEnd() + "\n";
}

export function htmlToMarkdown(html) {
  if (!html) return "";
  return tidy(getService().turndown(html));
}
