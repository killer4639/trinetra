export async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.json();
}
