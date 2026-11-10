/* SkyWay shared components loader and interactions.
   Include this file with defer from pages located in the project root. */
(() => {
  "use strict";

  const scriptUrl = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : new URL("js/shared.js", window.location.href).href;
  const projectRoot = new URL("../", scriptUrl);
  const componentUrl = (name) => new URL(`components/${name}.html`, projectRoot).href;

  // Theme is applied before components load so every page starts consistently.
  const THEME_KEY = "skyway-theme";
  const root = document.documentElement;
  const storedTheme = (() => {
    try { return localStorage.getItem(THEME_KEY); } catch (_) { return null; }
  })();
  const initialTheme = storedTheme === "light" || storedTheme === "dark"
    ? storedTheme
    : (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  root.dataset.theme = initialTheme;

  function applyTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch (_) { /* Storage may be blocked. */ }
    const toggle = document.querySelector("[data-sw-theme-toggle]");
    if (toggle) toggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }

  async function inject(selector, name) {
    const target = document.querySelector(selector);
    if (!target) return;
    try {
      const response = await fetch(componentUrl(name), { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Could not load ${name}: ${response.status}`);
      target.innerHTML = await response.text();
    } catch (error) {
      console.error(`[SkyWay] ${error.message}`);
      target.innerHTML = `<p class="sw-component-error">The ${name} component could not be loaded.</p>`;
    }
  }

  function setActiveNav() {
    const current = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".sw-primary-nav a, .sw-mobile-nav a").forEach((link) => {
      const destination = new URL(link.href, window.location.href).pathname.split("/").pop();
      if (destination === current) link.setAttribute("aria-current", "page");
    });
  }

  function initInteractions() {
    const header = document.querySelector("[data-sw-header]");
    const menuButton = document.querySelector("[data-sw-menu-toggle]");
    const mobileMenu = document.querySelector("[data-sw-mobile-menu]");

    const updateScrollState = () => {
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });

    document.querySelector("[data-sw-theme-toggle]")?.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });

    function closeMenu() {
      if (!menuButton || !mobileMenu) return;
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Open navigation menu");
      mobileMenu.hidden = true;
    }
    menuButton?.addEventListener("click", () => {
      const isOpen = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!isOpen));
      menuButton.setAttribute("aria-label", isOpen ? "Open navigation menu" : "Close navigation menu");
      mobileMenu.hidden = isOpen;
    });
    mobileMenu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 780) closeMenu();
    });

    const year = document.querySelector("[data-sw-year]");
    if (year) year.textContent = String(new Date().getFullYear());

    const form = document.querySelector("[data-sw-newsletter]");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const message = form.querySelector("[data-sw-newsletter-message]");
      if (!input || !message) return;
      message.classList.remove("is-success", "is-error");
      if (!input.value.trim() || !input.validity.valid) {
        message.textContent = "Please enter a valid email address.";
        message.classList.add("is-error");
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }
      input.removeAttribute("aria-invalid");
      message.textContent = "Thanks for subscribing! Your email has been validated.";
      message.classList.add("is-success");
      form.reset();
      // Connect this point to your newsletter API/backend to store subscriptions.
    });
  }

  async function start() {
    // The placeholders belong in each page; no page-specific sections are created here.
    await Promise.all([
      inject("#skyway-navbar", "navbar"),
      inject("#skyway-footer", "footer")
    ]);
    setActiveNav();
    initInteractions();
    applyTheme(root.dataset.theme || initialTheme);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();