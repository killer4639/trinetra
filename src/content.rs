//! Loads blog content (rudraksha beads and markdown posts) from disk once at startup.
//!
//! Content is small and read-mostly, so it is parsed and rendered to HTML up front and
//! served from memory; there is no per-request disk or markdown work.

use std::{
    fmt, fs, io,
    path::{Path, PathBuf},
};

use pulldown_cmark::{Options, Parser, html};
use serde::{Deserialize, Serialize};

/// Upper bounds keep startup work and memory predictable regardless of what is on disk.
const BEAD_COUNT_MAX: usize = 109; // 108 beads + the guru (sumeru) bead.
const POST_COUNT_MAX: usize = 4096;
const CONTENT_FILE_BYTES_MAX: u64 = 1024 * 1024;
const SLUG_BYTES_MAX: usize = 128;
const POST_HEADER_SEPARATOR: &str = "\n---\n";

#[derive(Debug)]
pub enum ContentError {
    Io { path: PathBuf, source: io::Error },
    Json { path: PathBuf, source: serde_json::Error },
    Invalid { path: PathBuf, reason: String },
}

impl fmt::Display for ContentError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io { path, source } => write!(formatter, "{}: {source}", path.display()),
            Self::Json { path, source } => write!(formatter, "{}: {source}", path.display()),
            Self::Invalid { path, reason } => write!(formatter, "{}: {reason}", path.display()),
        }
    }
}

impl std::error::Error for ContentError {}

fn invalid(path: &Path, reason: impl Into<String>) -> ContentError {
    ContentError::Invalid { path: path.to_path_buf(), reason: reason.into() }
}

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

#[derive(Serialize)]
pub struct PostSummary {
    slug: String,
    title: String,
    /// ISO-8601 calendar date (YYYY-MM-DD); lexical order equals chronological order.
    date: String,
    summary: String,
}

#[derive(Serialize)]
pub struct Post {
    #[serde(flatten)]
    summary: PostSummary,
    body_html: String,
}

pub struct Library {
    beads: Vec<Bead>,
    posts: Vec<Post>,
}

impl Library {
    pub fn load(content_root: &Path) -> Result<Self, ContentError> {
        let beads = load_beads(&content_root.join("beads.json"))?;
        let posts = load_posts(&content_root.join("posts"))?;
        assert!(beads.len() <= BEAD_COUNT_MAX);
        assert!(posts.len() <= POST_COUNT_MAX);
        Ok(Self { beads, posts })
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

    pub fn post_summaries(&self) -> Vec<&PostSummary> {
        let mut summaries = Vec::with_capacity(self.posts.len());
        for post in &self.posts {
            summaries.push(&post.summary);
        }
        summaries
    }

    pub fn post(&self, slug: &str) -> Option<&Post> {
        // Linear scan is fine: the post count is bounded and small; avoids a second index.
        self.posts.iter().find(|post| post.summary.slug == slug)
    }

    pub fn bead_count(&self) -> usize {
        self.beads.len()
    }

    pub fn post_count(&self) -> usize {
        self.posts.len()
    }
}

fn read_bounded(path: &Path) -> Result<String, ContentError> {
    let io_error = |source| ContentError::Io { path: path.to_path_buf(), source };
    let metadata = fs::metadata(path).map_err(io_error)?;
    if metadata.len() > CONTENT_FILE_BYTES_MAX {
        return Err(invalid(path, format!("file exceeds {CONTENT_FILE_BYTES_MAX} bytes")));
    }
    let text = fs::read_to_string(path).map_err(io_error)?;
    // Normalise Windows line endings so parsing has a single separator to look for.
    Ok(text.replace("\r\n", "\n"))
}

fn render_markdown(markdown: &str) -> String {
    let options = Options::ENABLE_TABLES | Options::ENABLE_FOOTNOTES | Options::ENABLE_STRIKETHROUGH;
    let mut html_output = String::with_capacity(markdown.len() + markdown.len() / 2);
    html::push_html(&mut html_output, Parser::new_ext(markdown, options));
    html_output
}

fn load_beads(path: &Path) -> Result<Vec<Bead>, ContentError> {
    let text = read_bounded(path)?;
    let sources: Vec<BeadSource> = serde_json::from_str(&text)
        .map_err(|source| ContentError::Json { path: path.to_path_buf(), source })?;
    if sources.is_empty() || sources.len() > BEAD_COUNT_MAX {
        return Err(invalid(path, format!("expected 1..={BEAD_COUNT_MAX} beads, got {}", sources.len())));
    }

    let mut beads = Vec::with_capacity(sources.len());
    for (position, source) in sources.into_iter().enumerate() {
        let index = u16::try_from(position).map_err(|_| invalid(path, "bead index overflow"))?;
        if source.title.trim().is_empty() {
            return Err(invalid(path, format!("bead {index} has an empty title")));
        }
        let body_html = render_markdown(&source.body_markdown);
        let summary = BeadSummary { index, title: source.title, subtitle: source.subtitle };
        beads.push(Bead { summary, body_html });
    }
    Ok(beads)
}

fn load_posts(directory: &Path) -> Result<Vec<Post>, ContentError> {
    let io_error = |source| ContentError::Io { path: directory.to_path_buf(), source };
    let mut posts = Vec::new();
    for entry in fs::read_dir(directory).map_err(io_error)? {
        let path = entry.map_err(io_error)?.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("md") {
            continue;
        }
        if posts.len() == POST_COUNT_MAX {
            return Err(invalid(directory, format!("more than {POST_COUNT_MAX} posts")));
        }
        let slug = slug_from_path(&path)?;
        let text = read_bounded(&path)?;
        posts.push(parse_post(&path, slug, &text)?);
    }
    // Newest first; slug breaks ties so ordering is deterministic across platforms.
    posts.sort_by(|left, right| {
        right.summary.date.cmp(&left.summary.date).then_with(|| left.summary.slug.cmp(&right.summary.slug))
    });
    Ok(posts)
}

fn slug_from_path(path: &Path) -> Result<String, ContentError> {
    let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) else {
        return Err(invalid(path, "file name is not valid UTF-8"));
    };
    let is_valid_char = |character: char| character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-';
    if stem.is_empty() || stem.len() > SLUG_BYTES_MAX || !stem.chars().all(is_valid_char) {
        return Err(invalid(path, "slug must be 1..=128 chars of [a-z0-9-]"));
    }
    Ok(stem.to_owned())
}

/// Posts are `key: value` header lines, a `---` line, then the markdown body.
fn parse_post(path: &Path, slug: String, text: &str) -> Result<Post, ContentError> {
    let Some((header, body)) = text.split_once(POST_HEADER_SEPARATOR) else {
        return Err(invalid(path, "missing '---' line between header and body"));
    };

    let (mut title, mut date, mut summary) = (None, None, None);
    for line in header.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let Some((key, value)) = line.split_once(':') else {
            return Err(invalid(path, format!("header line without ':' -> {line}")));
        };
        let value = value.trim().to_owned();
        match key.trim() {
            "title" => title = Some(value),
            "date" => date = Some(value),
            "summary" => summary = Some(value),
            unknown => return Err(invalid(path, format!("unknown header key '{unknown}'"))),
        }
    }

    let (Some(title), Some(date), Some(summary)) = (title, date, summary) else {
        return Err(invalid(path, "header requires title, date and summary"));
    };
    if !is_iso_date(&date) {
        return Err(invalid(path, format!("date '{date}' is not YYYY-MM-DD")));
    }
    let body_html = render_markdown(body);
    Ok(Post { summary: PostSummary { slug, title, date, summary }, body_html })
}

fn is_iso_date(text: &str) -> bool {
    let bytes = text.as_bytes();
    if bytes.len() != 10 {
        return false;
    }
    for (position, byte) in bytes.iter().enumerate() {
        let is_dash_position = position == 4 || position == 7;
        let is_valid = if is_dash_position { *byte == b'-' } else { byte.is_ascii_digit() };
        if !is_valid {
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_PATH: &str = "sample.md";

    #[test]
    fn parses_valid_post() {
        let text = "title: Hello\ndate: 2026-09-24\nsummary: A test\n---\n# Heading\n\nBody.";
        let post = parse_post(Path::new(SAMPLE_PATH), "hello".into(), text).expect("valid post must parse");
        assert_eq!(post.summary.title, "Hello");
        assert_eq!(post.summary.date, "2026-09-24");
        assert!(post.body_html.contains("<h1>Heading</h1>"));
    }

    #[test]
    fn rejects_post_without_separator() {
        let text = "title: Hello\ndate: 2026-09-24\nsummary: A test\n";
        assert!(parse_post(Path::new(SAMPLE_PATH), "hello".into(), text).is_err());
    }

    #[test]
    fn rejects_unknown_header_key_and_bad_date() {
        let unknown = "title: a\ndate: 2026-09-24\nsummary: b\nauthor: c\n---\nx";
        assert!(parse_post(Path::new(SAMPLE_PATH), "a".into(), unknown).is_err());
        let bad_date = "title: a\ndate: 24-09-2026\nsummary: b\n---\nx";
        assert!(parse_post(Path::new(SAMPLE_PATH), "a".into(), bad_date).is_err());
    }

    #[test]
    fn validates_slugs() {
        assert!(slug_from_path(Path::new("posts/good-slug-1.md")).is_ok());
        assert!(slug_from_path(Path::new("posts/Bad_Slug.md")).is_err());
        assert!(slug_from_path(Path::new("posts/.md")).is_err());
    }

    #[test]
    fn iso_date_boundaries() {
        assert!(is_iso_date("2026-01-31"));
        assert!(!is_iso_date("2026-1-31"));
        assert!(!is_iso_date("2026/01/31"));
        assert!(!is_iso_date(""));
    }
}
