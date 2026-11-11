/* =====================================================
   SKYWAY | SHARED (navbar, footer, theme)
   Used by every page. Load with `defer` from js/shared.js.

   1. Theme (light / dark)
   2. Optional component loader (#skyway-navbar / #skyway-footer)
   3. Navbar: active link, scroll shadow, mobile menu
   4. Footer: year + newsletter form
===================================================== */
(() => {
    "use strict";

    const root = document.documentElement;

    /* ---------- 1. THEME ---------- */
    const THEME_KEY = "skyway-theme";

    function getInitialTheme() {
        let stored = null;
        try { stored = localStorage.getItem(THEME_KEY); } catch (_) { /* storage blocked */ }
        if (stored === "light" || stored === "dark") return stored;
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }

    function applyTheme(theme) {
        root.dataset.theme = theme;
        try { localStorage.setItem(THEME_KEY, theme); } catch (_) { /* storage blocked */ }

        const toggle = document.querySelector("[data-sw-theme-toggle]");
        if (toggle) {
            toggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
        }
        document.dispatchEvent(new CustomEvent("skyway:themechange", { detail: { theme } }));
    }

    function initTheme() {
        applyTheme(root.dataset.theme === "light" || root.dataset.theme === "dark" ? root.dataset.theme : getInitialTheme());

        document.querySelector("[data-sw-theme-toggle]")?.addEventListener("click", () => {
            applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
        });

        // Follow the OS setting until the visitor picks a theme themselves.
        window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", (event) => {
            let stored = null;
            try { stored = localStorage.getItem(THEME_KEY); } catch (_) { /* ignore */ }
            if (!stored) applyTheme(event.matches ? "dark" : "light");
        });
    }

    /* ---------- 2. COMPONENT LOADER ----------
       Pages that use <div id="skyway-navbar"></div> / <div id="skyway-footer"></div>
       get the shared HTML from /components. Pages with inline markup skip this. */
    const scriptUrl = document.currentScript?.src || new URL("js/shared.js", window.location.href).href;
    const projectRoot = new URL("../", scriptUrl);

    async function inject(selector, name) {
        const target = document.querySelector(selector);
        if (!target) return;
        try {
            const response = await fetch(new URL(`components/${name}.html`, projectRoot), { credentials: "same-origin" });
            if (!response.ok) throw new Error(`Could not load ${name}: ${response.status}`);
            target.innerHTML = await response.text();
        } catch (error) {
            console.error(`[SkyWay] ${error.message}`);
            target.innerHTML = `<p class="sw-component-error">The ${name} component could not be loaded.</p>`;
        }
    }

    /* ---------- 3. NAVBAR ---------- */
    function setActiveNav() {
        const current = window.location.pathname.split("/").pop() || "index.html";
        document.querySelectorAll(".sw-primary-nav a, .sw-mobile-nav a").forEach((link) => {
            const destination = new URL(link.href, window.location.href).pathname.split("/").pop();
            if (destination === current) link.setAttribute("aria-current", "page");
        });
    }

    function initNavbar() {
        const header = document.querySelector("[data-sw-header]");
        const menuButton = document.querySelector("[data-sw-menu-toggle]");
        const mobileMenu = document.querySelector("[data-sw-mobile-menu]");

        const updateScrollState = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
        updateScrollState();
        window.addEventListener("scroll", updateScrollState, { passive: true });

        if (!menuButton || !mobileMenu) return;

        const setMenu = (open) => {
            menuButton.setAttribute("aria-expanded", String(open));
            menuButton.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
            mobileMenu.hidden = !open;
        };

        menuButton.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
        mobileMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
        document.addEventListener("keydown", (event) => { if (event.key === "Escape") setMenu(false); });
        window.addEventListener("resize", () => { if (window.innerWidth > 780) setMenu(false); });
    }

    /* ---------- 4. FOOTER ---------- */
    function initFooter() {
        const year = document.querySelector("[data-sw-year]");
        if (year) year.textContent = String(new Date().getFullYear());

        const form = document.querySelector("[data-sw-newsletter]");
        if (!form) return;

        form.addEventListener("submit", (event) => {
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

    /* ---------- START ---------- */
    async function start() {
        await Promise.all([
            inject("#skyway-navbar", "navbar"),
            inject("#skyway-footer", "footer")
        ]);
        setActiveNav();
        initNavbar();
        initFooter();
        initTheme();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
/* =====================================================
   SKYWAY | CONTACT PAGE
   Page interactions. Requires the markup in contact.html.

   1. Helpers
   2. Toast notifications
   3. Clipboard
   4. Animations (reveal, counters, ripple, tilt)
   5. Live clocks
   6. Contact methods (copy buttons)
   7. Global hubs (tabs)
   8. FAQ accordion
   9. Contact form (validation, progress, draft, submit)
===================================================== */
(() => {
    "use strict";

    /* =====================================================
       1. HELPERS
    ===================================================== */
    const $ = (selector, scope = document) => scope.querySelector(selector);
    const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const debounce = (fn, wait = 400) => {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), wait);
        };
    };

    const storage = {
        get(key) {
            try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; }
        },
        set(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* storage full or blocked */ }
        },
        remove(key) {
            try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
        }
    };

    /* Restart a CSS animation class on an element. */
    const replayClass = (element, className) => {
        element.classList.remove(className);
        void element.offsetWidth; // force reflow
        element.classList.add(className);
    };


    /* =====================================================
       2. TOAST NOTIFICATIONS
    ===================================================== */
    const Toast = (() => {
        const region = $("[data-toast-region]");
        const icons = {
            success: "fa-circle-check",
            error: "fa-circle-exclamation",
            info: "fa-circle-info"
        };

        function show(message, type = "info", duration = 3200) {
            if (!region) return;

            const toast = document.createElement("div");
            toast.className = `toast toast--${type}`;
            toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}" aria-hidden="true"></i><span></span>`;
            toast.querySelector("span").textContent = message;
            region.appendChild(toast);

            // Keep at most 3 toasts on screen
            while (region.children.length > 3) region.firstElementChild.remove();

            requestAnimationFrame(() => toast.classList.add("is-visible"));

            setTimeout(() => {
                toast.classList.remove("is-visible");
                setTimeout(() => toast.remove(), 450);
            }, duration);
        }

        return { show };
    })();


    /* =====================================================
       3. CLIPBOARD
    ===================================================== */
    async function copyText(text, successMessage = "Copied to clipboard") {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const helper = document.createElement("textarea");
                helper.value = text;
                helper.setAttribute("readonly", "");
                helper.style.position = "fixed";
                helper.style.opacity = "0";
                document.body.appendChild(helper);
                helper.select();
                const ok = document.execCommand("copy");
                helper.remove();
                if (!ok) throw new Error("copy failed");
            }
            Toast.show(successMessage, "success");
            return true;
        } catch (_) {
            Toast.show("Couldn't copy automatically. Please copy it manually.", "error");
            return false;
        }
    }


    /* =====================================================
       4. ANIMATIONS
    ===================================================== */

    /* Fade + slide elements in as they enter the viewport. */
    function initReveal() {
        const items = $$("[data-reveal]");

        items.forEach((item) => {
            if (item.dataset.revealDelay) item.style.setProperty("--reveal-delay", `${item.dataset.revealDelay}ms`);
        });

        if (reducedMotion || !("IntersectionObserver" in window)) {
            items.forEach((item) => item.classList.add("is-visible"));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

        items.forEach((item) => observer.observe(item));
    }

    /* Count numbers up from 0 when they become visible. */
    function initCounters() {
        const counters = $$("[data-count]");

        const run = (element) => {
            const target = Number(element.dataset.count) || 0;
            if (reducedMotion) {
                element.textContent = String(target);
                return;
            }
            const duration = 1600;
            const start = performance.now();
            const tick = (now) => {
                const progress = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                element.textContent = String(Math.round(target * eased));
                if (progress < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        };

        if (!("IntersectionObserver" in window)) {
            counters.forEach(run);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                run(entry.target);
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.6 });

        counters.forEach((counter) => observer.observe(counter));
    }

    /* Material-style ripple on any [data-ripple] element. */
    function initRipple() {
        if (reducedMotion) return;

        document.addEventListener("pointerdown", (event) => {
            const target = event.target.closest("[data-ripple]");
            if (!target || target.disabled) return;

            const rect = target.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const ripple = document.createElement("span");

            ripple.className = "ripple";
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
            ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

            target.appendChild(ripple);
            ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
        });
    }

    /* Subtle 3D tilt that follows the pointer (desktop only). */
    function initTilt() {
        if (reducedMotion || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

        $$("[data-tilt]").forEach((card) => {
            card.addEventListener("pointermove", (event) => {
                const rect = card.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width - 0.5;
                const y = (event.clientY - rect.top) / rect.height - 0.5;
                card.style.setProperty("--tilt-x", `${(-y * 6).toFixed(2)}deg`);
                card.style.setProperty("--tilt-y", `${(x * 8).toFixed(2)}deg`);
            });
            card.addEventListener("pointerleave", () => {
                card.style.setProperty("--tilt-x", "0deg");
                card.style.setProperty("--tilt-y", "0deg");
            });
        });
    }

    /* Swap broken images for their data-fallback source. */
    function initImageFallbacks() {
        $$("img[data-fallback]").forEach((image) => {
            image.addEventListener("error", () => {
                if (image.src !== image.dataset.fallback) image.src = image.dataset.fallback;
            }, { once: true });
        });
    }


    /* =====================================================
       5. LIVE CLOCKS
       <span data-clock="local"> or data-clock="Europe/London"
    ===================================================== */
    function formatTime(timeZone) {
        return new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: timeZone === "local" ? undefined : timeZone
        }).format(new Date());
    }

    function updateClocks() {
        $$("[data-clock]").forEach((element) => {
            try {
                element.textContent = formatTime(element.dataset.clock);
            } catch (_) {
                element.textContent = "--:--";
            }
        });
    }

    function initClocks() {
        updateClocks();
        setInterval(updateClocks, 10000);
    }


    /* =====================================================
       6. CONTACT METHODS (copy buttons)
    ===================================================== */
    function initCopyButtons() {
        $$("[data-copy]").forEach((button) => {
            button.addEventListener("click", async () => {
                const copied = await copyText(button.dataset.copy, button.dataset.copyLabel);
                if (!copied) return;
                const icon = $("i", button);
                if (!icon) return;
                icon.className = "fa-solid fa-check";
                setTimeout(() => { icon.className = "fa-regular fa-copy"; }, 1600);
            });
        });
    }


    /* =====================================================
       7. GLOBAL HUBS (accessible tabs)
    ===================================================== */
    const HUBS = {
        LAX: {
            title: "Los Angeles International Hub (LAX)",
            desc: "Terminal 4, Flight Suite 102 • 24/7 Operations",
            coord: "33.9416° N, 118.4085° W",
            lat: 33.9416,
            lng: -118.4085,
            timeZone: "America/Los_Angeles",
            img: "https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?auto=format&fit=crop&w=1400&q=80",
            alt: "Los Angeles airport runway"
        },
        LHR: {
            title: "London Heathrow Dispatch Hub (LHR)",
            desc: "Hangar 8, Runway North • European Operations",
            coord: "51.4700° N, 0.4543° W",
            lat: 51.47,
            lng: -0.4543,
            timeZone: "Europe/London",
            img: "https://images.unsplash.com/photo-1529074963764-98f45c47344b?auto=format&fit=crop&w=1400&q=80",
            alt: "London Heathrow airport"
        },
        HND: {
            title: "Tokyo Haneda Aviation Terminal (HND)",
            desc: "Sky Control Wing 2 • Asia-Pacific Operations",
            coord: "35.5494° N, 139.7798° E",
            lat: 35.5494,
            lng: 139.7798,
            timeZone: "Asia/Tokyo",
            img: "https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&w=1400&q=80",
            alt: "Tokyo Haneda airport"
        }
    };

    function initHubs() {
        const tabs = $$("[data-hub]");
        const panel = $("#hub-panel");
        if (!tabs.length || !panel) return;

        const images = $$("[data-hub-img]", panel);
        const info = $("[data-hub-info]", panel);
        const ui = {
            title: $("[data-hub-title]", panel),
            desc: $("[data-hub-desc]", panel),
            coord: $("[data-hub-coord]", panel),
            time: $("[data-hub-time]", panel),
            directions: $("[data-hub-directions]", panel),
            copy: $("[data-hub-copy]", panel)
        };

        let activeKey = "LAX";
        let activeImage = 0;

        // Preload the other hub photos so switching is instant.
        Object.values(HUBS).forEach((hub) => { new Image().src = hub.img; });

        function crossfadeTo(hub) {
            const current = images[activeImage];
            const next = images[1 - activeImage];
            if (!next || current.getAttribute("src") === hub.img) return;

            const swap = () => {
                current.classList.remove("is-active");
                next.classList.add("is-active");
                activeImage = 1 - activeImage;
            };
            next.onload = swap;
            next.onerror = swap;
            next.alt = hub.alt;
            current.alt = "";
            next.src = hub.img;
        }

        function select(key, { focus = false } = {}) {
            const hub = HUBS[key];
            if (!hub) return;
            const changed = key !== activeKey;
            activeKey = key;

            tabs.forEach((tab) => {
                const selected = tab.dataset.hub === key;
                tab.setAttribute("aria-selected", String(selected));
                tab.tabIndex = selected ? 0 : -1;
                if (selected && focus) tab.focus();
            });
            panel.setAttribute("aria-labelledby", `hub-tab-${key}`);

            ui.title.textContent = hub.title;
            ui.desc.textContent = hub.desc;
            ui.coord.textContent = hub.coord;
            ui.time.dataset.clock = hub.timeZone;
            ui.directions.href = `https://www.google.com/maps/search/?api=1&query=${hub.lat},${hub.lng}`;
            updateClocks();

            if (changed) {
                crossfadeTo(hub);
                replayClass(info, "is-animating");
            }
        }

        tabs.forEach((tab, index) => {
            tab.addEventListener("click", () => select(tab.dataset.hub));

            // Arrow keys / Home / End move between tabs
            tab.addEventListener("keydown", (event) => {
                const keys = {
                    ArrowRight: (index + 1) % tabs.length,
                    ArrowLeft: (index - 1 + tabs.length) % tabs.length,
                    Home: 0,
                    End: tabs.length - 1
                };
                if (!(event.key in keys)) return;
                event.preventDefault();
                select(tabs[keys[event.key]].dataset.hub, { focus: true });
            });
        });

        ui.copy?.addEventListener("click", () => copyText(HUBS[activeKey].coord, "Coordinates copied"));

        select(activeKey);
    }


    /* =====================================================
       8. FAQ ACCORDION (one open at a time)
    ===================================================== */
    function initFaq() {
        const items = $$("[data-faq]");

        items.forEach((item) => {
            const trigger = $("[data-faq-trigger]", item);
            trigger?.addEventListener("click", () => {
                const willOpen = !item.classList.contains("is-open");

                items.forEach((other) => {
                    other.classList.remove("is-open");
                    $("[data-faq-trigger]", other)?.setAttribute("aria-expanded", "false");
                });

                item.classList.toggle("is-open", willOpen);
                trigger.setAttribute("aria-expanded", String(willOpen));
            });
        });
    }


    /* =====================================================
       9. CONTACT FORM
    ===================================================== */
    function initContactForm() {
        const form = $("#contact-form");
        if (!form) return;

        const card = form.closest("[data-form-card]");
        const success = $("[data-form-success]");
        const submitButton = $("[data-submit]", form);
        const submitLabel = $("[data-submit-label]", form);
        const progress = $("[data-progress]");
        const progressRing = $("[data-progress-ring]");
        const progressValue = $("[data-progress-value]");
        const charCount = $("[data-char-count]", form);
        const draftStatus = $("[data-draft-status]", form);

        const DRAFT_KEY = "skyway-contact-draft";
        const MESSAGE_MIN = 10;
        const MESSAGE_MAX = 1000;
        const RING_LENGTH = 2 * Math.PI * 26;
        const REQUIRED = ["topic", "name", "email", "message", "consent"];

        const TOPIC_LABELS = {
            flight: "Flight Booking",
            cancellation: "Cancellation",
            refund: "Refund",
            payment: "Payment",
            other: "Other Inquiry"
        };

        const touched = new Set();

        /* ---- Read form values ---- */
        function getData() {
            const data = new FormData(form);
            const text = (name) => String(data.get(name) || "").trim();
            return {
                topic: text("topic"),
                name: text("name"),
                email: text("email"),
                phone: text("phone"),
                booking: text("booking").toUpperCase(),
                contactMethod: text("contactMethod") || "email",
                message: text("message"),
                consent: form.elements.consent.checked
            };
        }

        /* ---- Validation rules: return an error message or "" ---- */
        const RULES = {
            topic: (value) => (value ? "" : "Please choose what your message is about."),

            name: (value) => {
                if (!value) return "Please enter your full name.";
                if (value.length < 2) return "Your name needs at least 2 characters.";
                if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(value)) return "Please use letters only.";
                return "";
            },

            email: (value) => {
                if (!value) return "Please enter your email address.";
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return "Please enter a valid email, e.g. name@example.com.";
                return "";
            },

            phone: (value, data) => {
                if (!value) return data.contactMethod === "phone" ? "Add a phone number so we can call you back." : "";
                const digits = value.replace(/\D/g, "").length;
                if (!/^\+?[\d\s().-]+$/.test(value) || digits < 7 || digits > 15) return "Please enter a valid phone number.";
                return "";
            },

            booking: (value) => (!value || /^[A-Z0-9]{6}$/.test(value) ? "" : "A booking reference has exactly 6 letters or numbers."),

            message: (value) => {
                if (!value) return "Please write your message.";
                if (value.length < MESSAGE_MIN) {
                    const left = MESSAGE_MIN - value.length;
                    return `Please add ${left} more character${left === 1 ? "" : "s"}.`;
                }
                return "";
            },

            consent: (value) => (value ? "" : "Please accept the terms and privacy policy.")
        };

        const fieldOf = (name) => form.querySelector(`[data-field="${name}"]`);

        function setFieldState(name, error, data) {
            const field = fieldOf(name);
            if (!field) return;

            const value = data[name];
            const hasValue = typeof value === "boolean" ? value : Boolean(value);

            field.classList.toggle("is-invalid", Boolean(error));
            field.classList.toggle("is-valid", !error && hasValue);
            $$("input, textarea", field).forEach((input) => input.setAttribute("aria-invalid", String(Boolean(error))));

            const errorElement = $("[data-error]", field);
            if (errorElement) errorElement.textContent = error;
        }

        function validateField(name, data = getData()) {
            const error = RULES[name] ? RULES[name](data[name], data) : "";
            setFieldState(name, error, data);
            return !error;
        }

        /* Returns the names of all invalid fields. */
        function validateAll() {
            const data = getData();
            return Object.keys(RULES).filter((name) => !validateField(name, data));
        }

        /* ---- Progress ring ---- */
        function updateProgress() {
            const data = getData();
            const done = REQUIRED.filter((name) => !RULES[name](data[name], data)).length;
            const percent = Math.round((done / REQUIRED.length) * 100);

            progressRing.style.strokeDasharray = String(RING_LENGTH);
            progressRing.style.strokeDashoffset = String(RING_LENGTH * (1 - percent / 100));
            progressValue.textContent = String(percent);
            progress.setAttribute("aria-valuenow", String(percent));
            progress.classList.toggle("is-complete", percent === 100);
        }

        /* ---- Character counter ---- */
        function updateCounter() {
            const length = form.elements.message.value.length;
            charCount.textContent = `${length} / ${MESSAGE_MAX}`;
            charCount.classList.toggle("is-warning", length > MESSAGE_MAX * 0.9);
        }

        /* ---- Phone becomes required when "Phone call" is chosen ---- */
        function syncContactMethod() {
            const byPhone = getData().contactMethod === "phone";
            $("[data-phone-optional]", form).hidden = byPhone;
            $("[data-phone-required]", form).hidden = !byPhone;
            form.elements.phone.required = byPhone;
        }

        /* ---- Draft auto-save ---- */
        function setDraftStatus(text) {
            draftStatus.textContent = text;
            draftStatus.classList.toggle("is-visible", Boolean(text));
        }

        const saveDraft = debounce(() => {
            const { consent, ...draft } = getData();
            const hasContent = ["topic", "name", "email", "phone", "booking", "message"].some((key) => draft[key]);
            if (!hasContent) {
                storage.remove(DRAFT_KEY);
                setDraftStatus("");
                return;
            }
            storage.set(DRAFT_KEY, draft);
            setDraftStatus("✓ Draft saved on this device");
        }, 600);

        function restoreDraft() {
            const draft = storage.get(DRAFT_KEY);
            if (!draft || typeof draft !== "object") return;

            ["name", "email", "phone", "booking", "message"].forEach((key) => {
                if (typeof draft[key] === "string") form.elements[key].value = draft[key];
            });
            const topic = form.querySelector(`input[name="topic"][value="${CSS.escape(draft.topic || "")}"]`);
            if (topic) topic.checked = true;
            const method = form.querySelector(`input[name="contactMethod"][value="${CSS.escape(draft.contactMethod || "email")}"]`);
            if (method) method.checked = true;

            // Show validation state for the restored values only
            const data = getData();
            Object.keys(RULES).forEach((name) => {
                if (name !== "consent" && data[name]) {
                    touched.add(name);
                    validateField(name, data);
                }
            });

            setDraftStatus("✓ Your unsent message was restored");
            Toast.show("We restored your unsent message.", "info");
        }

        /* ---- Live validation ---- */
        function handleChange(event) {
            const { name, type } = event.target;
            if (!name) return;

            if (name === "booking") {
                event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
            }
            if (name === "message") updateCounter();
            if (name === "contactMethod") {
                syncContactMethod();
                if (touched.has("phone") || form.elements.phone.value) validateField("phone");
            }
            if (type === "radio" || type === "checkbox") touched.add(name);
            if (touched.has(name) && RULES[name]) validateField(name);

            updateProgress();
            saveDraft();
        }

        form.addEventListener("input", handleChange);
        form.addEventListener("change", (event) => {
            if (event.target.type === "radio" || event.target.type === "checkbox") handleChange(event);
        });

        // Validate a text field after the visitor leaves it
        form.addEventListener("focusout", (event) => {
            const { name, type, value } = event.target;
            if (!name || !RULES[name] || type === "radio" || type === "checkbox") return;
            if (!value.trim() && !touched.has(name)) return;
            touched.add(name);
            validateField(name);
        });

        // Ctrl / Cmd + Enter sends the form
        form.addEventListener("keydown", (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                form.requestSubmit ? form.requestSubmit() : submitButton.click();
            }
        });

        /* ---- Submit ---- */
        function setSubmitting(isSubmitting) {
            form.classList.toggle("is-submitting", isSubmitting);
            submitButton.disabled = isSubmitting;
            submitButton.setAttribute("aria-busy", String(isSubmitting));
            submitLabel.textContent = isSubmitting ? "Sending…" : "Send Message";
        }

        function createTicketId() {
            const random = Math.random().toString(36).slice(2, 5).toUpperCase();
            const time = Date.now().toString(36).slice(-3).toUpperCase();
            return `SKY-${time}${random}`;
        }

        /* Replace this with a real request to your backend (e.g. fetch("/api/contact")). */
        function sendMessage(data) {
            return new Promise((resolve) => {
                setTimeout(() => resolve({ ticket: createTicketId(), data }), 1400);
            });
        }

        function showSuccess(data, ticket) {
            $("[data-success-name]", success).textContent = data.name.split(" ")[0];
            $("[data-success-channel]", success).textContent = data.contactMethod === "phone"
                ? `by phone at ${data.phone}`
                : `at ${data.email}`;
            $("[data-success-ticket]", success).textContent = ticket;

            form.hidden = true;
            success.hidden = false;
            success.focus({ preventScroll: true });
            card.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });

            Toast.show(`Message sent • ${TOPIC_LABELS[data.topic] || "Support"}`, "success");
        }

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (form.classList.contains("is-submitting")) return;

            Object.keys(RULES).forEach((name) => touched.add(name));
            const invalid = validateAll();
            updateProgress();

            if (invalid.length) {
                replayClass(card, "is-shaking");
                const firstField = fieldOf(invalid[0]);
                firstField?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
                $("input:not([type=radio]), textarea, input[type=radio]", firstField)?.focus({ preventScroll: true });
                Toast.show(`Please fix ${invalid.length} field${invalid.length === 1 ? "" : "s"} before sending.`, "error");
                return;
            }

            const data = getData();
            setSubmitting(true);
            try {
                const { ticket } = await sendMessage(data);
                storage.remove(DRAFT_KEY);
                showSuccess(data, ticket);
            } catch (_) {
                Toast.show("Something went wrong. Please try again.", "error");
            } finally {
                setSubmitting(false);
            }
        });

        /* ---- Reset to a fresh form ---- */
        function resetForm() {
            form.reset();
            touched.clear();
            $$("[data-field]", form).forEach((field) => field.classList.remove("is-valid", "is-invalid"));
            $$("[data-error]", form).forEach((element) => { element.textContent = ""; });
            $$("[aria-invalid]", form).forEach((element) => element.removeAttribute("aria-invalid"));
            setDraftStatus("");
            syncContactMethod();
            updateCounter();
            updateProgress();

            success.hidden = true;
            form.hidden = false;
            $('input[name="topic"]', form)?.focus({ preventScroll: true });
        }

        $("[data-reset-form]", success)?.addEventListener("click", resetForm);
        $("[data-copy-ticket]", success)?.addEventListener("click", () => {
            copyText($("[data-success-ticket]", success).textContent, "Ticket number copied");
        });

        /* ---- Init ---- */
        restoreDraft();
        syncContactMethod();
        updateCounter();
        updateProgress();
    }


    /* =====================================================
       START
    ===================================================== */
    function start() {
        initReveal();
        initCounters();
        initRipple();
        initTilt();
        initImageFallbacks();
        initClocks();
        initCopyButtons();
        initHubs();
        initFaq();
        initContactForm();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
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