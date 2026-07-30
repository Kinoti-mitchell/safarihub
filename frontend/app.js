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

const params = new URLSearchParams(window.location.search);
const name = params.get("name");
const market = params.get("market");
const headline = params.get("headline");
const sub = params.get("sub");
const appOverride = params.get("app");

const appBase = String(
  appOverride || window.SAFARI_HUB_APP_URL || "https://safari-hub.onrender.com",
)
  .trim()
  .replace(/\/+$/, "");

function appUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${appBase}${p}`;
}

document.querySelectorAll("[data-app-href]").forEach((el) => {
  const path = el.getAttribute("data-app-href") || "/";
  el.setAttribute("href", appUrl(path));
});

const footerApp = document.getElementById("footer-app-link");
if (footerApp) footerApp.setAttribute("href", `${appBase}/`);

if (name) {
  document.title = name;
  document
    .getElementById("brand-name")
    ?.replaceChildren(document.createTextNode(name));
  document
    .getElementById("footer-brand")
    ?.replaceChildren(document.createTextNode(name));
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
