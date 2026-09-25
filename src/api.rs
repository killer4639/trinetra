//! Route parsing for the Worker; pure so it is unit-tested on the native target.
//!
//! The native server routes with axum instead. Both must expose the same paths:
//! `/api/beads`, `/api/beads/{index}`, `/api/posts`, `/api/posts/{slug}`.

const BEADS_PREFIX: &str = "/api/beads";
const POSTS_PREFIX: &str = "/api/posts";

#[derive(Debug, PartialEq, Eq)]
pub enum ApiRoute<'a> {
    Beads,
    Bead(u16),
    Posts,
    Post(&'a str),
}

/// Returns `None` for any path that is not an API route (the caller answers 404).
pub fn route(path: &str) -> Option<ApiRoute<'_>> {
    if let Some(rest) = path.strip_prefix(BEADS_PREFIX) {
        return match item_segment(rest)? {
            None => Some(ApiRoute::Beads),
            Some(segment) => segment.parse::<u16>().ok().map(ApiRoute::Bead),
        };
    }
    if let Some(rest) = path.strip_prefix(POSTS_PREFIX) {
        return match item_segment(rest)? {
            None => Some(ApiRoute::Posts),
            Some(segment) => Some(ApiRoute::Post(segment)),
        };
    }
    None
}

/// After the collection prefix: `""` is the collection, `"/x"` is item `x`, anything
/// else (`"s"`, `"/"`, `"/x/y"`) is not a route.
fn item_segment(rest: &str) -> Option<Option<&str>> {
    if rest.is_empty() {
        return Some(None);
    }
    let segment = rest.strip_prefix('/')?;
    if segment.is_empty() || segment.contains('/') {
        return None;
    }
    Some(Some(segment))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routes_collections_and_items() {
        assert_eq!(route("/api/beads"), Some(ApiRoute::Beads));
        assert_eq!(route("/api/beads/0"), Some(ApiRoute::Bead(0)));
        assert_eq!(route("/api/beads/65535"), Some(ApiRoute::Bead(65535)));
        assert_eq!(route("/api/posts"), Some(ApiRoute::Posts));
        assert_eq!(
            route("/api/posts/one-hundred-and-eight"),
            Some(ApiRoute::Post("one-hundred-and-eight"))
        );
    }

    #[test]
    fn rejects_non_routes() {
        assert_eq!(route("/"), None);
        assert_eq!(route("/api"), None);
        assert_eq!(route("/api/beadsx"), None);
        assert_eq!(route("/api/beads/"), None);
        assert_eq!(route("/api/beads/65536"), None);
        assert_eq!(route("/api/beads/-1"), None);
        assert_eq!(route("/api/posts/a/b"), None);
    }
}
