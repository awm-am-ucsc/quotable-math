// Filters the quote list on /quotes/ as you type. Reads ?q= so the home page
// search box lands here pre-filtered.
const input = document.getElementById("filter");
const cards = [...document.querySelectorAll("#quotes .quote")];
const count = document.getElementById("count");
const empty = document.getElementById("empty");

function apply() {
  const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const card of cards) {
    const match = terms.every((t) => card.dataset.search.includes(t));
    card.hidden = !match;
    if (match) shown++;
  }
  count.textContent = terms.length ? `${shown} of ${cards.length} quotes` : `${cards.length} quotes`;
  empty.hidden = shown > 0;

  const url = new URL(location.href);
  if (input.value) url.searchParams.set("q", input.value);
  else url.searchParams.delete("q");
  history.replaceState(null, "", url);
}

input.value = new URLSearchParams(location.search).get("q") ?? "";
input.addEventListener("input", apply);
if (input.value) apply();
