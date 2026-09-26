//! The rudraksha beads, compiled in from `content/beads.json`.
//!
//! Content is small and read-only, so it is parsed and rendered to HTML once at startup
//! and served from memory. Embedding (rather than reading from disk) lets the same code
//! run natively and inside a Cloudflare Worker, which has no filesystem.

use std::fmt;

use pulldown_cmark::{Options, Parser, html};
use serde::{Deserialize, Serialize};

/// Upper bounds keep startup work and memory predictable regardless of what is embedded.
const BEAD_COUNT_MAX: usize = 109; // 108 beads + the guru (sumeru) bead.
const BEADS_JSON_BYTES_MAX: usize = 1024 * 1024;
const BEADS_JSON: &str = include_str!("../content/beads.json");

#[derive(Debug)]
pub enum ContentError {
    Json(serde_json::Error),
    Invalid(String),
}

impl fmt::Display for ContentError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Json(source) => write!(formatter, "content/beads.json: {source}"),
            Self::Invalid(reason) => write!(formatter, "content/beads.json: {reason}"),
        }
    }
}

impl std::error::Error for ContentError {}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct BeadSource {
    title: String,
    subtitle: String,
    body_markdown: String,
}

#[derive(Serialize)]
pub struct BeadSummary {
    index: u16,
    title: String,
    subtitle: String,
}

#[derive(Serialize)]
pub struct Bead {
    #[serde(flatten)]
    summary: BeadSummary,
    body_html: String,
}

pub struct Library {
    beads: Vec<Bead>,
}

impl Library {
    /// Parses the beads compiled into this binary.
    pub fn embedded() -> Result<Self, ContentError> {
        Self::parse(BEADS_JSON)
    }

    pub fn parse(beads_json: &str) -> Result<Self, ContentError> {
        let beads = parse_beads(beads_json)?;
        assert!(!beads.is_empty() && beads.len() <= BEAD_COUNT_MAX);
        Ok(Self { beads })
    }

    pub fn bead_summaries(&self) -> Vec<&BeadSummary> {
        let mut summaries = Vec::with_capacity(self.beads.len());
        for bead in &self.beads {
            summaries.push(&bead.summary);
        }
        summaries
    }

    pub fn bead(&self, index: u16) -> Option<&Bead> {
        self.beads.get(usize::from(index))
    }

    pub fn bead_count(&self) -> usize {
        self.beads.len()
    }
}

fn render_markdown(markdown: &str) -> String {
    let options =
        Options::ENABLE_TABLES | Options::ENABLE_FOOTNOTES | Options::ENABLE_STRIKETHROUGH;
    let mut html_output = String::with_capacity(markdown.len() + markdown.len() / 2);
    html::push_html(&mut html_output, Parser::new_ext(markdown, options));
    html_output
}

fn parse_beads(beads_json: &str) -> Result<Vec<Bead>, ContentError> {
    if beads_json.len() > BEADS_JSON_BYTES_MAX {
        return Err(ContentError::Invalid(format!(
            "file exceeds {BEADS_JSON_BYTES_MAX} bytes"
        )));
    }
    let sources: Vec<BeadSource> = serde_json::from_str(beads_json).map_err(ContentError::Json)?;
    if sources.is_empty() || sources.len() > BEAD_COUNT_MAX {
        return Err(ContentError::Invalid(format!(
            "expected 1..={BEAD_COUNT_MAX} beads, got {}",
            sources.len()
        )));
    }

    let mut beads = Vec::with_capacity(sources.len());
    for (position, source) in sources.into_iter().enumerate() {
        let index = u16::try_from(position)
            .map_err(|_| ContentError::Invalid("bead index overflow".into()))?;
        if source.title.trim().is_empty() {
            return Err(ContentError::Invalid(format!(
                "bead {index} has an empty title"
            )));
        }
        let body_html = render_markdown(&source.body_markdown);
        let summary = BeadSummary {
            index,
            title: source.title,
            subtitle: source.subtitle,
        };
        beads.push(Bead { summary, body_html });
    }
    Ok(beads)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_beads_are_valid() {
        let library =
            Library::embedded().expect("content/beads.json must parse; fix the reported error");
        assert!(library.bead_count() > 0);
        assert!(library.bead(0).is_some());
    }

    #[test]
    fn renders_markdown_body() {
        let json = r#"[{"title": "A", "subtitle": "b", "body_markdown": "*c*"}]"#;
        let library = Library::parse(json).expect("valid beads must parse");
        let bead = library.bead(0).expect("bead 0 exists");
        assert_eq!(bead.body_html, "<p><em>c</em></p>\n");
        assert!(library.bead(1).is_none());
    }

    #[test]
    fn rejects_invalid_beads() {
        assert!(Library::parse("[]").is_err());
        assert!(
            Library::parse(r#"[{"title": " ", "subtitle": "", "body_markdown": ""}]"#).is_err()
        );
        assert!(
            Library::parse(r#"[{"title": "A", "subtitle": "", "body_markdown": "", "extra": 1}]"#)
                .is_err()
        );
    }
}
