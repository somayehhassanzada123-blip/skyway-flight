/* =====================================================================
   AEROLIGHT — Interactions (Vanilla JavaScript, ES6+)
   Sections:
     1. Helpers & data
     2. Header, mobile menu & active links
     3. Hero: star field & live flight cards
     4. Search widget (tabs, autocomplete, swap, dates, passengers, …)
     5. Search results dialog
     6. Destinations
     7. Deals (filter tabs + countdown)
     8. Hotels & Packages tabs, favorites
     9. About: counters & testimonial slider
    10. FAQ accordion
    11. Newsletter & auth dialog
    12. Scroll reveal, back-to-top, misc
   ===================================================================== */
(() => {
  "use strict";



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

  /* -------------------------------------------------------------------
     1. HELPERS & DATA
     ------------------------------------------------------------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const icon = (id) => `<svg class="icon"><use href="#i-${id}"/></svg>`;

  /** Small toast notification */
  const toast = (message, type = "success") => {
    const wrap = $("#toasts");
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.innerHTML = `${icon(type === "error" ? "x" : "check")}<span></span>`;
    el.querySelector("span").textContent = message;
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add("is-leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }, 3200);
  };

  /** Date helpers (local time, yyyy-mm-dd for <input type="date">) */
  const toISO = (d) => {
    const z = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  };
  const addDays = (d, n) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
  const fmtDate = (iso) => iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  /** Airports used by autocomplete, destinations list and results */
  const AIRPORTS = [
    { city: "Jakarta", code: "CGK", country: "Indonesia", from: 260 },
    { city: "Tokyo", code: "NRT", country: "Japan", from: 420 },
    { city: "Paris", code: "CDG", country: "France", from: 610 },
    { city: "Dubai", code: "DXB", country: "UAE", from: 390 },
    { city: "Amsterdam", code: "AMS", country: "Netherlands", from: 580 },
    { city: "Bali", code: "DPS", country: "Indonesia", from: 180 },
    { city: "Lagos", code: "LOS", country: "Nigeria", from: 450 },
    { city: "New York", code: "JFK", country: "USA", from: 520 },
    { city: "Shanghai", code: "PVG", country: "China", from: 470 },
    { city: "Hong Kong", code: "HKG", country: "China", from: 340 },
    { city: "London", code: "LHR", country: "United Kingdom", from: 560 },
    { city: "Singapore", code: "SIN", country: "Singapore", from: 210 },
    { city: "Doha", code: "DOH", country: "Qatar", from: 495 },
    { city: "Sydney", code: "SYD", country: "Australia", from: 690 },
    { city: "Istanbul", code: "IST", country: "Türkiye", from: 380 },
    { city: "Los Angeles", code: "LAX", country: "USA", from: 540 },
    { city: "Barcelona", code: "BCN", country: "Spain", from: 470 },
    { city: "Seoul", code: "ICN", country: "South Korea", from: 450 },
    { city: "Cape Town", code: "CPT", country: "South Africa", from: 640 },
    { city: "Rome", code: "FCO", country: "Italy", from: 520 },
  ];
  const airportLabel = (a) => `${a.city} (${a.code})`;

  let currentStayTab = "hotels";

  // Back-to-top button (kept independently from the removed navbar)
  const onScroll = () => {
    const toTop = $("#toTop");
    if (toTop) toTop.classList.toggle("is-visible", window.scrollY > 250);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* -------------------------------------------------------------------
     3. HERO — STAR FIELD & LIVE FLIGHT CARDS
     ------------------------------------------------------------------- */
  (function starField() {
    const canvas = $("#starCanvas");
    const ctx = canvas.getContext("2d");
    let stars = [];
    let w = 0, h = 0, dpr = 1, running = true;

    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w * h) / 5200);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h * 0.85,
        r: Math.random() * 1.1 + 0.2,
        a: Math.random() * 0.7 + 0.2,
        s: Math.random() * 1.5 + 0.5,
        p: Math.random() * Math.PI * 2,
      }));
    };

    const draw = (t) => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const tw = prefersReducedMotion ? 1 : 0.6 + 0.4 * Math.sin(t / 1000 * s.s + s.p);
        ctx.globalAlpha = s.a * tw;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    };

    build();
    window.addEventListener("resize", build);
    new IntersectionObserver(([e]) => {
      const was = running;
      running = e.isIntersecting;
      if (running && !was) requestAnimationFrame(draw);
    }).observe(canvas);
    requestAnimationFrame(draw);
  })();

  // Capacity bar fills on load; flight status toggles between states
  setTimeout(() => {
    $("#capacityBar").style.width = "60%";
    const out = $("#capacityValue");
    const startT = performance.now();
    const step = (now) => {
      const p = Math.min((now - startT) / 1800, 1);
      out.textContent = `${Math.round(60 * (1 - Math.pow(1 - p, 3)))}%`;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, 600);

  const statusChip = $("#flightStatus");
  setInterval(() => {
    const onTime = statusChip.classList.toggle("is-ontime");
    statusChip.textContent = onTime ? "On Time" : "Delayed";
  }, 4000);

  /* -------------------------------------------------------------------
     4. SEARCH WIDGET
     ------------------------------------------------------------------- */
  const form = $("#searchForm");
  const state = {
    mode: "flights",   // flights | hotels
    trip: "round",     // round | oneway | multi
    cabin: "Economy",
    flexible: false,
    pax: { adults: 1, children: 0, infants: 0 },
  };

  // --- Default dates ---
  const today = new Date();
  const departInput = $("#departInput");
  const returnInput = $("#returnInput");
  const checkIn = $("#checkIn");
  const checkOut = $("#checkOut");
  [departInput, returnInput, checkIn, checkOut].forEach((i) => (i.min = toISO(today)));
  const setDefaultDates = () => {
    departInput.value = toISO(addDays(today, 14));
    returnInput.value = toISO(addDays(today, 21));
    checkIn.value = toISO(addDays(today, 14));
    checkOut.value = toISO(addDays(today, 18));
  };
  setDefaultDates();

  // Keep return/check-out after departure/check-in
  const linkDates = (startEl, endEl, gap) => {
    startEl.addEventListener("change", () => {
      endEl.min = startEl.value || toISO(today);
      if (!endEl.value || endEl.value < startEl.value) endEl.value = toISO(addDays(new Date(`${startEl.value}T00:00:00`), gap));
    });
  };
  linkDates(departInput, returnInput, 7);
  linkDates(checkIn, checkOut, 3);

  // --- Trip type tabs ---
  const tripTabs = $$("#tripTabs .segmented__btn");
  const setTrip = (trip) => {
    state.trip = trip;
    tripTabs.forEach((b) => {
      const on = b.dataset.trip === trip;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    $("#returnField").hidden = trip !== "round";
    $("#dateRow").style.gridTemplateColumns = trip === "round" ? "" : "1fr";
    $("#multiLegs").hidden = trip !== "multi";
    if (trip === "multi" && !$("#legList").children.length) addLeg();
  };
  tripTabs.forEach((b) => b.addEventListener("click", () => setTrip(b.dataset.trip)));

  // --- Multi-city legs ---
  const MAX_LEGS = 3;
  function addLeg() {
    const list = $("#legList");
    if (list.children.length >= MAX_LEGS) { toast(`You can add up to ${MAX_LEGS} extra flights`, "error"); return; }
    const n = list.children.length + 2;
    const prevDate = list.lastElementChild ? $("input[type=date]", list.lastElementChild).value : departInput.value;
    const leg = document.createElement("div");
    leg.className = "leg";
    leg.innerHTML = `
      <div class="field autocomplete"><label class="sr-only">Flight ${n} from</label><input type="text" autocomplete="off" placeholder="From" data-leg="from" /><ul class="suggestions" role="listbox"></ul></div>
      <div class="field autocomplete"><label class="sr-only">Flight ${n} to</label><input type="text" autocomplete="off" placeholder="To" data-leg="to" /><ul class="suggestions" role="listbox"></ul></div>
      <div class="field"><label class="sr-only">Flight ${n} date</label><input type="date" /></div>
      <button type="button" class="leg__remove" aria-label="Remove flight ${n}">${icon("x")}</button>`;
    const dateEl = $("input[type=date]", leg);
    dateEl.min = toISO(today);
    dateEl.value = toISO(addDays(new Date(`${prevDate || toISO(today)}T00:00:00`), 4));
    // Pre-fill the new leg's origin with the previous destination
    const prevTo = list.lastElementChild ? $("[data-leg=to]", list.lastElementChild).value : $("#toInput").value;
    $("[data-leg=from]", leg).value = prevTo;
    $(".leg__remove", leg).addEventListener("click", () => leg.remove());
    list.appendChild(leg);
    $$(".autocomplete", leg).forEach(initAutocomplete);
  }
  $("#addLegBtn").addEventListener("click", addLeg);

  // --- Airport autocomplete ---
  function initAutocomplete(wrapper) {
    const input = $("input", wrapper);
    const list = $(".suggestions", wrapper);
    let highlighted = -1;

    const render = () => {
      const q = input.value.trim().toLowerCase();
      const matches = AIRPORTS.filter((a) =>
        !q || `${a.city} ${a.code} ${a.country}`.toLowerCase().includes(q)
      ).slice(0, 6);
      highlighted = -1;
      list.innerHTML = matches.map((a) =>
        `<li role="option" data-value="${airportLabel(a)}"><span>${a.city} <small>${a.country}</small></span><small>${a.code}</small></li>`
      ).join("") || `<li aria-disabled="true"><small>No airports found</small></li>`;
      list.classList.add("is-open");
    };
    const close = () => list.classList.remove("is-open");
    const choose = (value) => { input.value = value; input.classList.remove("is-invalid"); close(); };

    input.addEventListener("focus", () => { input.select(); render(); });
    input.addEventListener("input", render);
    input.addEventListener("blur", () => setTimeout(close, 150));
    input.addEventListener("keydown", (e) => {
      const items = $$("li[data-value]", list);
      if (!items.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        highlighted = (highlighted + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach((li, i) => li.classList.toggle("is-highlighted", i === highlighted));
      } else if (e.key === "Enter" && list.classList.contains("is-open") && highlighted > -1) {
        e.preventDefault();
        choose(items[highlighted].dataset.value);
      } else if (e.key === "Escape") close();
    });
    list.addEventListener("mousedown", (e) => {
      const li = e.target.closest("li[data-value]");
      if (li) { e.preventDefault(); choose(li.dataset.value); }
    });
  }
  $$("#flightFields .field-group .autocomplete").forEach(initAutocomplete);

  // --- Swap origin/destination ---
  const swapBtn = $("#swapBtn");
  swapBtn.addEventListener("click", () => {
    const from = $("#fromInput"), to = $("#toInput");
    [from.value, to.value] = [to.value, from.value];
    swapBtn.classList.toggle("is-flipped");
  });

  // --- Passenger dropdown ---
  const paxToggle = $("#paxToggle");
  const paxMenu = $("#paxMenu");
  const updatePax = () => {
    const { adults, children, infants } = state.pax;
    const parts = [`${adults} Adult${adults > 1 ? "s" : ""}`];
    if (children) parts.push(`${children} Child${children > 1 ? "ren" : ""}`);
    if (infants) parts.push(`${infants} Bab${infants > 1 ? "ies" : "y"}`);
    const guests = adults + children;
    $("#paxLabel").textContent = state.mode === "hotels"
      ? `${guests + infants} Guest${guests + infants > 1 ? "s" : ""}, 1 Room`
      : `${parts.join(", ")}, ${state.cabin}`;
    $$(".counter", paxMenu).forEach((c) => {
      const type = c.dataset.type;
      const val = state.pax[type];
      $("output", c).textContent = val;
      $("[data-step='-1']", c).disabled = type === "adults" ? val <= 1 : val <= 0;
      $("[data-step='1']", c).disabled = adults + children >= 9 && type !== "infants" || (type === "infants" && val >= adults);
    });
  };
  const setPopover = (toggle, pop, open) => {
    toggle.setAttribute("aria-expanded", String(open));
    pop.classList.toggle("is-open", open);
  };
  paxToggle.addEventListener("click", () => setPopover(paxToggle, paxMenu, paxToggle.getAttribute("aria-expanded") !== "true"));
  $("#paxDone").addEventListener("click", () => setPopover(paxToggle, paxMenu, false));
  paxMenu.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-step]");
    if (!btn) return;
    const type = btn.closest(".counter").dataset.type;
    state.pax[type] += Number(btn.dataset.step);
    if (state.pax.infants > state.pax.adults) state.pax.infants = state.pax.adults;
    updatePax();
  });

  // --- Icon rail: flexible dates / hotels / cabin / flights ---
  const cabinBtn = $("[data-rail='cabin']");
  const cabinPop = $("#cabinPop");
  const setMode = (mode) => {
    state.mode = mode;
    $("#flightFields").hidden = mode !== "flights";
    $("#hotelFields").hidden = mode !== "hotels";
    $("#tripTabs").hidden = mode !== "flights";
    $("[data-rail='flights']").setAttribute("aria-pressed", String(mode === "flights"));
    $("[data-rail='flights']").classList.toggle("is-active", mode === "flights");
    $("[data-rail='hotels']").setAttribute("aria-pressed", String(mode === "hotels"));
    $("#searchLabel").textContent = mode === "hotels" ? "Search Hotels" : "Search";
    updatePax();
  };
  $$(".rail-btn").forEach((btn) => btn.addEventListener("click", () => {
    const action = btn.dataset.rail;
    if (action === "flights" || action === "hotels") setMode(action);
    if (action === "flexible") {
      state.flexible = !state.flexible;
      btn.setAttribute("aria-pressed", String(state.flexible));
      $("#flexNote").hidden = !state.flexible;
      toast(state.flexible ? "Flexible dates on (±3 days)" : "Flexible dates off");
    }
    if (action === "cabin") setPopover(cabinBtn, cabinPop, cabinBtn.getAttribute("aria-expanded") !== "true");
  }));
  $$("[data-cabin]", cabinPop).forEach((opt) => opt.addEventListener("click", () => {
    state.cabin = opt.dataset.cabin;
    $$("[data-cabin]", cabinPop).forEach((o) => o.setAttribute("aria-checked", String(o === opt)));
    setPopover(cabinBtn, cabinPop, false);
    updatePax();
    toast(`Cabin class: ${state.cabin}`);
  }));

  // Close popovers on outside click / Escape
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".pax")) setPopover(paxToggle, paxMenu, false);
    if (!e.target.closest(".rail-pop-wrap")) setPopover(cabinBtn, cabinPop, false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    setPopover(paxToggle, paxMenu, false);
    setPopover(cabinBtn, cabinPop, false);
    setMenu(false);
  });

  // --- Terms checkbox ---
  const terms = $("#termsCheck");
  terms.addEventListener("change", () => terms.closest(".checkbox").classList.remove("is-invalid"));

  // --- Clear button ---
  $("#clearBtn").addEventListener("click", () => {
    form.reset();
    $("#fromInput").value = "";
    $("#toInput").value = "";
    $("#hotelCity").value = "";
    $("#legList").innerHTML = "";
    state.pax = { adults: 1, children: 0, infants: 0 };
    setDefaultDates();
    setTrip("round");
    updatePax();
    $$(".is-invalid", form).forEach((el) => el.classList.remove("is-invalid"));
    $("#fromInput").focus();
  });

  // --- Submit (validate → show results) ---
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const invalid = [];
    const require = (el) => { const bad = !el.value.trim(); el.classList.toggle("is-invalid", bad); if (bad) invalid.push(el); };

    if (state.mode === "flights") {
      require($("#fromInput"));
      require($("#toInput"));
      require(departInput);
      if (state.trip === "round") require(returnInput);
      if (state.trip === "multi") $$("#legList input").forEach(require);
      const from = $("#fromInput").value.trim(), to = $("#toInput").value.trim();
      if (from && to && from.toLowerCase() === to.toLowerCase()) {
        $("#toInput").classList.add("is-invalid");
        toast("Origin and destination must be different", "error");
        return;
      }
    } else {
      require($("#hotelCity")); require(checkIn); require(checkOut);
    }

    if (invalid.length) { toast("Please fill in the highlighted fields", "error"); invalid[0].focus(); return; }
    if (!terms.checked) {
      const box = terms.closest(".checkbox");
      box.classList.remove("is-invalid"); void box.offsetWidth; box.classList.add("is-invalid");
      toast("Please accept the Terms & Conditions", "error");
      return;
    }

    // Fake network latency for a realistic feel
    const btn = $(".btn--search", form);
    btn.classList.add("is-loading");
    btn.disabled = true;
    setTimeout(() => {
      btn.classList.remove("is-loading");
      btn.disabled = false;
      state.mode === "flights" ? showFlightResults() : showHotelResults();
    }, 700);
  });

  /* -------------------------------------------------------------------
     5. SEARCH RESULTS DIALOG
     ------------------------------------------------------------------- */
  const resultsModal = $("#resultsModal");
  let currentResults = [];
  let currentKind = "flights";

  /** Seeded pseudo-random generator so the same route gives the same results */
  const seeded = (str) => {
    let h = 2166136261;
    for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
  };
  const codeOf = (label) => (label.match(/\(([A-Z]{3})\)/) || [])[1] || label.slice(0, 3).toUpperCase();
  const cabinFactor = { "Economy": 1, "Premium Economy": 1.6, "Business": 3.1, "First": 5.2 };

  function showFlightResults() {
    const from = $("#fromInput").value.trim();
    const to = $("#toInput").value.trim();
    const rand = seeded(from + to);
    const dest = AIRPORTS.find((a) => airportLabel(a) === to);
    const base = (dest ? dest.from : 300 + rand() * 400) * cabinFactor[state.cabin];
    const airlines = ["Aerolight Air", "SkyBridge", "Pacific Wings", "Nordic Jet", "Emerald Airways", "Atlas Air"];
    const travelers = state.pax.adults + state.pax.children + state.pax.infants * 0.1;

    currentKind = "flights";
    currentResults = Array.from({ length: 5 }, (_, i) => {
      const depH = 6 + Math.floor(rand() * 15), depM = [0, 15, 30, 45][Math.floor(rand() * 4)];
      const dur = 120 + Math.floor(rand() * 720);
      const stops = rand() > 0.55 ? 1 : 0;
      const arr = depH * 60 + depM + dur;
      const t = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      return {
        id: i,
        airline: airlines[Math.floor(rand() * airlines.length)],
        dep: t(depH * 60 + depM), arr: t(arr), nextDay: arr >= 1440,
        dur, stops,
        price: Math.round((base * (0.8 + rand() * 0.6) - stops * 40) * travelers),
      };
    });

    $("#resultsTitle").textContent = `${codeOf(from)} → ${codeOf(to)}`;
    const dates = state.trip === "round"
      ? `${fmtDate(departInput.value)} – ${fmtDate(returnInput.value)}`
      : fmtDate(departInput.value);
    const legs = state.trip === "multi" ? ` · +${$("#legList").children.length} more flight(s)` : "";
    $("#resultsSub").textContent = `${dates}${legs} · ${$("#paxLabel").textContent}${state.flexible ? " · Flexible ±3 days" : ""}`;
    $("#sortTabs").hidden = false;
    setSort("best");
    openModal(resultsModal);
  }

  function showHotelResults() {
    const city = $("#hotelCity").value.trim();
    const rand = seeded(city);
    const nights = Math.max(1, Math.round((new Date(checkOut.value) - new Date(checkIn.value)) / 86400000));
    const names = ["Grand Horizon", "Skyline Suites", "The Aero House", "Harbor View Inn", "Blue Lantern Hotel"];
    currentKind = "hotels";
    currentResults = names.map((name, i) => ({
      id: i, name, rating: (4 + rand() * 0.9).toFixed(1),
      perNight: Math.round(90 + rand() * 260),
    })).map((h) => ({ ...h, price: h.perNight * nights, nights }));
    $("#resultsTitle").textContent = `Hotels in ${city}`;
    $("#resultsSub").textContent = `${fmtDate(checkIn.value)} – ${fmtDate(checkOut.value)} · ${nights} night${nights > 1 ? "s" : ""} · ${$("#paxLabel").textContent}`;
    $("#sortTabs").hidden = true;
    renderResults(currentResults);
    openModal(resultsModal);
  }

  const fmtDur = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
  const money = (n) => `$${n.toLocaleString("en-US")}`;

  function renderResults(list) {
    const ul = $("#resultsList");
    if (currentKind === "hotels") {
      ul.innerHTML = list.map((h, i) => `
        <li class="result" style="animation-delay:${i * 60}ms">
          <span class="airline" style="--h:${200 + i * 30}">${h.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
          <div><strong>${h.name}</strong><div class="rating">${icon("star")} ${h.rating}</div></div>
          <div class="result__price"><strong>${money(h.price)}</strong><small class="stay-price">${money(h.perNight)}/night</small>
            <button class="btn btn--primary btn--sm" data-select="${h.name}">Select</button></div>
        </li>`).join("");
      return;
    }
    const from = codeOf($("#fromInput").value), to = codeOf($("#toInput").value);
    const cheapest = Math.min(...list.map((f) => f.price));
    const fastest = Math.min(...list.map((f) => f.dur));
    ul.innerHTML = list.map((f, i) => `
      <li class="result" style="animation-delay:${i * 60}ms">
        <span class="airline" style="--h:${(f.airline.length * 37) % 360}">${f.airline.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
        <div>
          <small class="stay-price">${f.airline}${f.price === cheapest ? '<span class="result__tag">Cheapest</span>' : ""}${f.dur === fastest ? '<span class="result__tag">Fastest</span>' : ""}</small>
          <div class="result__times">
            <div><strong>${f.dep}</strong><small>${from}</small></div>
            <div class="result__dur">${fmtDur(f.dur)} · ${f.stops ? "1 stop" : "Direct"}</div>
            <div><strong>${f.arr}${f.nextDay ? "<sup>+1</sup>" : ""}</strong><small>${to}</small></div>
          </div>
        </div>
        <div class="result__price"><strong>${money(f.price)}</strong>
          <button class="btn btn--primary btn--sm" data-select="${f.airline} ${f.dep}">Select</button></div>
      </li>`).join("");
  }

  function setSort(key) {
    $$("#sortTabs .tabs__btn").forEach((b) => {
      const on = b.dataset.sort === key;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    const sorted = [...currentResults].sort((a, b) =>
      key === "cheapest" ? a.price - b.price :
      key === "fastest" ? a.dur - b.dur :
      (a.price / 100 + a.dur / 60) - (b.price / 100 + b.dur / 60)
    );
    renderResults(sorted);
  }
  $$("#sortTabs .tabs__btn").forEach((b) => b.addEventListener("click", () => setSort(b.dataset.sort)));

  $("#resultsList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-select]");
    if (!btn) return;
    closeModal(resultsModal);
    toast(`${btn.dataset.select} selected — your seat is held for 15 minutes`);
  });

  /* Generic dialog helpers */
  function openModal(dialog) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    document.body.classList.add("no-scroll");
  }
  function closeModal(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }
  $$("dialog.modal").forEach((dialog) => {
    dialog.addEventListener("close", () => document.body.classList.remove("no-scroll"));
    dialog.addEventListener("click", (e) => { if (e.target === dialog) closeModal(dialog); }); // backdrop click
    $$("[data-close]", dialog).forEach((b) => b.addEventListener("click", () => closeModal(dialog)));
  });

  /* -------------------------------------------------------------------
     6. DESTINATIONS
     ------------------------------------------------------------------- */
  /** Fill the "To" field with a destination and bring the search panel into view */
  const goToSearch = (toLabel, fromLabel) => {
    setMode("flights");
    if (fromLabel) $("#fromInput").value = fromLabel;
    $("#toInput").value = toLabel;
    $("#toInput").classList.remove("is-invalid");
    $("#searchPanel").scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
    const panel = $("#searchForm");
    panel.animate?.([{ boxShadow: "0 0 0 0 rgba(47,123,255,.0)" }, { boxShadow: "0 0 0 3px rgba(47,123,255,.6)" }, { boxShadow: "0 0 0 0 rgba(47,123,255,0)" }], { duration: 1400, delay: 400 });
  };

  $$(".dest-card").forEach((card) => card.addEventListener("click", () => {
    goToSearch(card.dataset.city);
    toast(`${card.dataset.name} added as your destination`);
  }));

  // "View All Destinations" dialog with live search
  const destModal = $("#destModal");
  const destList = $("#destList");
  const renderDestinations = (q = "") => {
    const query = q.trim().toLowerCase();
    const items = AIRPORTS.filter((a) => `${a.city} ${a.country} ${a.code}`.toLowerCase().includes(query));
    destList.innerHTML = items.length
      ? items.map((a) => `<li><button data-dest="${airportLabel(a)}"><span><strong>${a.city}</strong><small>${a.country} · ${a.code}</small></span><span class="price">From $${a.from}</span></button></li>`).join("")
      : `<li class="empty">No destinations match “${q.replace(/[<>&"]/g, "")}”.</li>`;
  };
  $("#viewAllBtn").addEventListener("click", () => {
    $("#destSearch").value = "";
    renderDestinations();
    openModal(destModal);
  });
  $("#destSearch").addEventListener("input", (e) => renderDestinations(e.target.value));
  destList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-dest]");
    if (!btn) return;
    closeModal(destModal);
    goToSearch(btn.dataset.dest);
    toast(`${btn.dataset.dest} added as your destination`);
  });

  /* -------------------------------------------------------------------
     7. DEALS — FILTER TABS & COUNTDOWN
     ------------------------------------------------------------------- */
  const dealTabs = $$("#dealTabs .tabs__btn");
  dealTabs.forEach((tab) => tab.addEventListener("click", () => {
    const filter = tab.dataset.filter;
    dealTabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    $$("#dealGrid .deal-card").forEach((card, i) => {
      const show = filter === "all" || card.dataset.region === filter;
      card.classList.toggle("is-hidden", !show);
      card.classList.remove("is-entering");
      if (show) { void card.offsetWidth; card.style.animationDelay = `${(i % 3) * 60}ms`; card.classList.add("is-entering"); }
    });
  }));

  $("#dealGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-book]");
    if (!btn) return;
    const [from, to] = btn.dataset.book.split("|");
    goToSearch(to, from);
    toast(`Deal applied: ${codeOf(from)} → ${codeOf(to)}`);
  });

  // Countdown resets every 24h at local midnight
  const countdownEl = $("#countdown");
  const tickCountdown = () => {
    const now = new Date();
    const end = new Date(now); end.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((end - now) / 1000));
    const z = (n) => String(n).padStart(2, "0");
    countdownEl.textContent = `${z(Math.floor(s / 3600))}:${z(Math.floor((s % 3600) / 60))}:${z(s % 60)}`;
  };
  tickCountdown();
  setInterval(tickCountdown, 1000);

  /* -------------------------------------------------------------------
     8. HOTELS & PACKAGES TABS, FAVORITES, RESERVE
     ------------------------------------------------------------------- */
  const stayTabs = $$("#stayTabs .segmented__btn");
  const setStayTab = (key) => {
    currentStayTab = key;
    stayTabs.forEach((t) => {
      const on = t.dataset.stay === key;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    $$("[data-stay-panel]").forEach((p) => (p.hidden = p.dataset.stayPanel !== key));
  };
  stayTabs.forEach((t) => t.addEventListener("click", () => { setStayTab(t.dataset.stay); setActiveLink(t.dataset.stay); }));

  // Nav links "Hotels" / "Packages" also switch the tab
  $$("[data-stay-tab]").forEach((link) => link.addEventListener("click", () => {
    setStayTab(link.dataset.stayTab);
    setTimeout(() => setActiveLink(link.dataset.stayTab), 50);
  }));

  $$(".fav-btn").forEach((btn) => btn.addEventListener("click", () => {
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? "Remove from favorites" : "Save to favorites");
    toast(on ? "Saved to your favorites" : "Removed from favorites");
  }));
  $$("[data-reserve]").forEach((btn) => btn.addEventListener("click", () => {
    btn.innerHTML = `${icon("check")} Reserved`;
    btn.disabled = true;
    toast(`${btn.dataset.reserve} reserved — check your email for details`);
  }));

  /* -------------------------------------------------------------------
     9. ABOUT — ANIMATED COUNTERS & TESTIMONIAL SLIDER
     ------------------------------------------------------------------- */
  const counterObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseFloat(el.dataset.count);
      const decimals = Number(el.dataset.decimals || 0);
      const suffix = el.dataset.suffix || "";
      const start = performance.now();
      const dur = prefersReducedMotion ? 1 : 1600;
      const step = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(decimals) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  $$("[data-count]").forEach((el) => counterObserver.observe(el));

  (function slider() {
    const track = $("#testimonialTrack");
    const slides = $$(".testimonial", track);
    const dotsWrap = $("#sliderDots");
    let index = 0, timer;

    dotsWrap.innerHTML = slides.map((_, i) => `<button aria-label="Show testimonial ${i + 1}"></button>`).join("");
    const dots = $$("button", dotsWrap);

    const go = (i) => {
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, n) => d.classList.toggle("is-active", n === index));
      slides.forEach((s, n) => s.setAttribute("aria-hidden", String(n !== index)));
    };
    const restart = () => { clearInterval(timer); if (!prefersReducedMotion) timer = setInterval(() => go(index + 1), 6000); };

    $("#prevSlide").addEventListener("click", () => { go(index - 1); restart(); });
    $("#nextSlide").addEventListener("click", () => { go(index + 1); restart(); });
    dots.forEach((d, i) => d.addEventListener("click", () => { go(i); restart(); }));

    // Touch / pointer swipe
    let startX = null;
    const root = $("#testimonials");
    root.addEventListener("pointerdown", (e) => { startX = e.clientX; });
    root.addEventListener("pointerup", (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 50) { go(index + (dx < 0 ? 1 : -1)); restart(); }
      startX = null;
    });
    root.addEventListener("mouseenter", () => clearInterval(timer));
    root.addEventListener("mouseleave", restart);

    go(0);
    restart();
  })();

  /* -------------------------------------------------------------------
     10. FAQ ACCORDION (one open at a time)
     ------------------------------------------------------------------- */
  $$(".accordion__trigger").forEach((trigger) => trigger.addEventListener("click", () => {
    const item = trigger.closest(".accordion__item");
    const willOpen = !item.classList.contains("is-open");
    $$(".accordion__item").forEach((other) => {
      other.classList.remove("is-open");
      $(".accordion__trigger", other).setAttribute("aria-expanded", "false");
    });
    item.classList.toggle("is-open", willOpen);
    trigger.setAttribute("aria-expanded", String(willOpen));
  }));

  /* -------------------------------------------------------------------
     11. NEWSLETTER & AUTH DIALOG
     ------------------------------------------------------------------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  $("#newsletterForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const input = $("#newsletterEmail");
    const msg = $("#newsletterMsg");
    formEl.classList.remove("is-invalid");
    if (!EMAIL_RE.test(input.value.trim())) {
      void formEl.offsetWidth;
      formEl.classList.add("is-invalid");
      msg.className = "form-msg is-error";
      msg.textContent = "Please enter a valid email address.";
      return;
    }
    msg.className = "form-msg is-success";
    msg.textContent = `You're subscribed! Deals will arrive at ${input.value.trim()}.`;
    input.value = "";
  });

  const authModal = $("#authModal");
  const authTabs = $$("#authTabs .segmented__btn");
  const setAuth = (mode) => {
    authTabs.forEach((t) => {
      const on = t.dataset.auth === mode;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    $("#nameField").hidden = mode !== "signup";
    $("#authTitle").textContent = mode === "signup" ? "Create your account" : "Welcome back";
    $("#authSubmit").textContent = mode === "signup" ? "Create Account" : "Login";
    $("#authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
    $("#authMsg").textContent = "";
    authModal.dataset.mode = mode;
  };
  authTabs.forEach((t) => t.addEventListener("click", () => setAuth(t.dataset.auth)));
  $$("[data-open-auth]").forEach((btn) => btn.addEventListener("click", () => {
    setAuth(btn.dataset.openAuth);
    openModal(authModal);
  }));

  $("#pwToggle").addEventListener("click", (e) => {
    const input = $("#authPassword");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    e.currentTarget.classList.toggle("is-on", show);
    e.currentTarget.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  $("#authForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const mode = authModal.dataset.mode || "login";
    const name = $("#authName"), email = $("#authEmail"), pw = $("#authPassword");
    const msg = $("#authMsg");
    let error = "";
    if (mode === "signup" && name.value.trim().length < 2) error = "Please enter your full name.";
    else if (!EMAIL_RE.test(email.value.trim())) error = "Please enter a valid email address.";
    else if (pw.value.length < 6) error = "Password must be at least 6 characters.";
    [name, email, pw].forEach((i) => i.classList.remove("is-invalid"));
    if (error) {
      msg.className = "form-msg is-error";
      msg.textContent = error;
      (error.includes("name") ? name : error.includes("email") ? email : pw).classList.add("is-invalid");
      return;
    }
    const who = mode === "signup" ? name.value.trim().split(" ")[0] : email.value.trim().split("@")[0];
    closeModal(authModal);
    e.currentTarget.reset();
    toast(mode === "signup" ? `Welcome aboard, ${who}! Your account is ready.` : `Signed in as ${who}`);
  });

  /* -------------------------------------------------------------------
     12. SCROLL REVEAL, BACK-TO-TOP, MISC
     ------------------------------------------------------------------- */
  // Stagger siblings inside the same parent for a cascading reveal
  $$(".reveal").forEach((el) => {
    const siblings = $$(":scope > .reveal", el.parentElement);
    el.style.setProperty("--delay", `${Math.min(siblings.indexOf(el), 5) * 0.08}s`);
  });
  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach((el) => revealObserver.observe(el));

  // Animate the steps connector line once visible
  new IntersectionObserver(([e], obs) => {
    if (e.isIntersecting) { e.target.classList.add("is-active"); obs.disconnect(); }
  }, { threshold: 0.4 }).observe($("#stepsList"));

  $("#toTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" }));
  $("#buyTicketsBtn").addEventListener("click", (e) => {
    e.preventDefault();
    $("#searchPanel").scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
    setTimeout(() => $("#fromInput").focus({ preventScroll: true }), 600);
  });
  $$('a[href="#"]').forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));

  updatePax();
})();
