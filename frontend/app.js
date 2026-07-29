const slides = Array.from(document.querySelectorAll(".hero-slide"));
let index = 0;

if (slides.length > 1) {
  window.setInterval(() => {
    slides[index]?.classList.remove("is-active");
    index = (index + 1) % slides.length;
    slides[index]?.classList.add("is-active");
  }, 7000);
}

const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());

// Optional overrides via query (?name=MyBrand&market=Coast)
const params = new URLSearchParams(window.location.search);
const name = params.get("name");
const market = params.get("market");
const headline = params.get("headline");
const sub = params.get("sub");

if (name) {
  document.title = name;
  document.getElementById("brand-name")?.replaceChildren(document.createTextNode(name));
  document.getElementById("footer-brand")?.replaceChildren(document.createTextNode(name));
  const mark = document.querySelector(".brand-mark");
  if (mark) {
    mark.textContent = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("");
  }
}
if (market) {
  document
    .getElementById("market-label")
    ?.replaceChildren(document.createTextNode(market));
}
if (headline) {
  document
    .getElementById("headline")
    ?.replaceChildren(document.createTextNode(headline));
}
if (sub) {
  document
    .getElementById("subheadline")
    ?.replaceChildren(document.createTextNode(sub));
}
