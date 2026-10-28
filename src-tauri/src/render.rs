//! Markdown to HTML rendering with comrak (GFM, footnotes, alerts, math, front matter).
//!
//! The HTML keeps raw HTML (`unsafe`) and is therefore NOT safe to inject as is: the frontend
//! must sanitise it with DOMPurify before displaying it. Code is not highlighted here; fenced
//! blocks come out as `<pre><code class="language-xxx">` for highlight.js (and `language-mermaid`
//! for diagrams), and math as `<span data-math-style="inline|display">` for KaTeX.

use comrak::nodes::NodeValue;
use comrak::{Arena, Options, format_html, parse_document};
use serde::Serialize;

use crate::error::AppResult;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Rendered {
    pub html: String,
    /// YAML between the `---` fences, without the fences; `None` when the document has none.
    pub front_matter: Option<String>,
}

fn options() -> Options<'static> {
    let mut options = Options::default();
    let extension = &mut options.extension;
    extension.table = true;
    extension.strikethrough = true;
    extension.tasklist = true;
    extension.autolink = true;
    extension.footnotes = true;
    extension.alerts = true;
    extension.highlight = true;
    extension.math_dollars = true;
    extension.front_matter_delimiter = Some("---".into());
    extension.header_id_prefix = Some(String::new());
    options.render.r#unsafe = true;
    options.render.sourcepos = true;
    options
}

/// Text of a front matter node without its fences and surrounding line breaks.
fn front_matter_body(raw: &str) -> String {
    let inner = raw.trim();
    let inner = inner.strip_prefix("---").unwrap_or(inner);
    let inner = inner.strip_suffix("---").unwrap_or(inner);
    inner.trim_matches(['\r', '\n']).to_string()
}

pub fn render(markdown: &str) -> Rendered {
    let arena = Arena::new();
    let options = options();
    let root = parse_document(&arena, markdown, &options);

    let front_matter = root.children().find_map(|node| match &node.data().value {
        NodeValue::FrontMatter(raw) => {
            node.detach();
            Some(front_matter_body(raw))
        }
        _ => None,
    });

    let mut html = String::new();
    format_html(root, &options, &mut html).expect("writing HTML to a String cannot fail");
    Rendered { html, front_matter }
}

#[tauri::command]
pub async fn render_markdown(markdown: String) -> AppResult<Rendered> {
    Ok(render(&markdown))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn html(markdown: &str) -> String {
        render(markdown).html
    }

    #[test]
    fn renders_tables() {
        let out = html("| a | b |\n|---|---|\n| 1 | 2 |\n");
        assert!(out.contains("<table"), "{out}");
        assert!(out.contains("<th"), "{out}");
    }

    #[test]
    fn renders_task_lists() {
        let out = html("- [x] done\n- [ ] todo\n");
        assert!(out.contains(r#"type="checkbox""#), "{out}");
        assert!(out.contains("checked"), "{out}");
    }

    #[test]
    fn renders_strikethrough() {
        assert!(html("~~gone~~").contains(">gone</del>"));
    }

    #[test]
    fn renders_highlight() {
        assert!(html("==marked==").contains(">marked</mark>"));
    }

    #[test]
    fn links_bare_urls() {
        assert!(html("see https://example.com now").contains(r#"href="https://example.com""#));
    }

    #[test]
    fn renders_footnotes() {
        let out = html("text[^1]\n\n[^1]: the note\n");
        assert!(out.contains("footnote-ref"), "{out}");
        assert!(out.contains("the note"), "{out}");
    }

    #[test]
    fn renders_alerts() {
        assert!(html("> [!NOTE]\n> hi\n").contains("markdown-alert-note"));
    }

    #[test]
    fn captures_front_matter_and_removes_it_from_html() {
        let rendered = render("---\ntitle: Hi\ntags: [a]\n---\n\n# Body\n");
        assert_eq!(
            rendered.front_matter.as_deref(),
            Some("title: Hi\ntags: [a]")
        );
        assert!(!rendered.html.contains("title: Hi"));
        assert!(rendered.html.contains("Body"));
    }

    #[test]
    fn captures_front_matter_with_crlf() {
        let rendered = render("---\r\ntitle: Hi\r\n---\r\n\r\n# Body\r\n");
        assert_eq!(rendered.front_matter.as_deref(), Some("title: Hi"));
    }

    #[test]
    fn has_no_front_matter_when_absent() {
        assert_eq!(render("# Body\n").front_matter, None);
    }

    #[test]
    fn marks_inline_and_display_math_for_katex() {
        let out = html("Inline $a^2$ here\n\n$$\nb\n$$\n");
        assert!(out.contains(r#"data-math-style="inline""#), "{out}");
        assert!(out.contains(r#"data-math-style="display""#), "{out}");
    }

    #[test]
    fn adds_source_positions() {
        let out = html("# Title\n\npara\n");
        assert!(out.contains(r#"data-sourcepos="1:1-1:7""#), "{out}");
        assert!(out.contains(r#"data-sourcepos="3:1-3:4""#), "{out}");
    }

    #[test]
    fn keeps_language_class_on_fences() {
        let out = html("```rust\nfn x() {}\n```\n\n```mermaid\nflowchart LR\n```\n");
        assert!(out.contains(r#"<code class="language-rust">"#), "{out}");
        assert!(out.contains(r#"<code class="language-mermaid">"#), "{out}");
    }

    #[test]
    fn passes_raw_html_through() {
        assert!(html("<div class=\"x\">hi</div>\n").contains("<div class=\"x\">hi</div>"));
    }

    /// Same inputs as the `slugify` tests in `src/lib/domain/outline.test.ts`.
    #[test]
    fn heading_ids_match_the_typescript_slugs() {
        let cases = [
            ("Hello, World!", "hello-world"),
            ("Año 2024", "año-2024"),
            ("C++ & Rust", "c--rust"),
            ("日本語 の 見出し", "日本語-の-見出し"),
            ("snake_case and kebab-case", "snake_case-and-kebab-case"),
            ("Ünïcödé Çafé", "ünïcödé-çafé"),
            ("What is this?", "what-is-this"),
        ];
        for (text, slug) in cases {
            let out = html(&format!("# {text}\n"));
            assert!(out.contains(&format!(r#"id="{slug}""#)), "{text}: {out}");
        }
    }

    #[test]
    fn numbers_duplicate_heading_ids() {
        let out = html("# Same\n\n# Same\n\n# Same\n");
        for id in ["same", "same-1", "same-2"] {
            assert!(out.contains(&format!(r#"id="{id}""#)), "{id}: {out}");
        }
    }

    /// Known difference: the TypeScript slugger falls back to `section`, comrak leaves it empty.
    #[test]
    fn heading_without_slug_characters_gets_an_empty_id() {
        assert!(html("# !!!\n").contains(r#"id="""#));
    }
}
