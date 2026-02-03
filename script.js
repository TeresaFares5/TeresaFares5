/// ================================
// Mobile hamburger nav
// ================================
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

function closeMobileNav() {
  if (!navLinks || !navToggle) return;

  navLinks.classList.remove("is-open");
  navToggle.setAttribute("aria-expanded", "false");

  const icon = navToggle.querySelector("i");
  if (icon) icon.className = "ri-menu-line";
}

navToggle?.addEventListener("click", () => {
  if (!navLinks) return;

  const isOpen = navLinks.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));

  const icon = navToggle.querySelector("i");
  if (icon) icon.className = isOpen ? "ri-close-line" : "ri-menu-line";
});

// Close menu when a nav link is clicked
navLinks?.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", () => closeMobileNav());
});

// Close if you click/tap outside
document.addEventListener("click", (e) => {
  if (!navLinks || !navToggle) return;
  const clickedInside = navLinks.contains(e.target) || navToggle.contains(e.target);
  if (!clickedInside) closeMobileNav();
});

// Close on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMobileNav();
});

// ================================
// Smooth scroll for in-page anchors (nav links)
// ================================
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const targetId = a.getAttribute("href");
    if (!targetId || targetId === "#") return;

    const target = document.querySelector(targetId);
    if (!target) return;

    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

// ================================
// Back-to-top button logic
// ================================
const backToTopBtn = document.getElementById("backToTop");

window.addEventListener("scroll", () => {
  if (!backToTopBtn) return;
  backToTopBtn.style.display = window.scrollY > 300 ? "flex" : "none";
});

backToTopBtn?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ================================
// Projects Carousel
// ================================

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const viewport = document.getElementById("projectsViewport");
const track = document.getElementById("projectsTrack");

if (viewport && track) {
  const prevBtn = document.querySelector(".carousel-btn.prev");
  const nextBtn = document.querySelector(".carousel-btn.next");
  const dotsWrap = document.getElementById("projectsDots");

  // Real cards only (before cloning)
  const originals = Array.from(track.querySelectorAll(".carousel-card"));
  const n = originals.length;

  if (n < 2) {
    console.warn("Carousel needs at least 2 cards.");
  } else {
    // Tag originals with a logical index
    originals.forEach((card, i) => (card.dataset.index = String(i)));

    // Clone full set to both ends
    const headClones = originals.map((c) => {
      const clone = c.cloneNode(true);
      clone.classList.add("is-clone");
      clone.dataset.index = c.dataset.index;
      return clone;
    });

    const tailClones = originals.map((c) => {
      const clone = c.cloneNode(true);
      clone.classList.add("is-clone");
      clone.dataset.index = c.dataset.index;
      return clone;
    });

    // Prepend head clones (reverse so visual order stays correct)
    headClones
      .slice()
      .reverse()
      .forEach((c) => track.insertBefore(c, track.firstChild));

    // Append tail clones
    tailClones.forEach((c) => track.appendChild(c));

    // Now includes clones + originals
    const allCards = Array.from(track.querySelectorAll(".carousel-card"));

    // ----------------------------
    // State for stable recentering
    // ----------------------------
    let isRecentering = false;
    let idleTimer = null;
    let lastScrollLeft = viewport.scrollLeft;

    // ----------------------------
    // Measurements
    // ----------------------------
    function getGapPx() {
      const cs = getComputedStyle(track);
      const g = parseFloat(cs.gap || cs.columnGap || "0");
      return Number.isFinite(g) ? g : 0;
    }

    function getCardW() {
      return originals[0].getBoundingClientRect().width;
    }

    function oneSetWidth() {
      // width of ONE logical set (n cards + gaps between them)
      const w = getCardW();
      const gap = getGapPx();
      return w * n + gap * (n - 1);
    }

    // ----------------------------
    // Dots
    // ----------------------------
    function buildDots() {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = "";
      for (let i = 0; i < n; i++) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "carousel-dot";
        dot.setAttribute("aria-label", `Go to project ${i + 1}`);
        dot.addEventListener("click", () => goToNearestLogical(i, true));
        dotsWrap.appendChild(dot);
      }
    }

    function setActiveDot(i) {
      if (!dotsWrap) return;
      const dots = Array.from(dotsWrap.querySelectorAll(".carousel-dot"));
      dots.forEach((d) => d.classList.remove("is-active"));
      if (dots[i]) dots[i].classList.add("is-active");
    }

    // ----------------------------
    // Active card detection
    // ----------------------------
    function setActiveCard(el) {
      allCards.forEach((c) => c.classList.remove("is-active"));
      if (el) el.classList.add("is-active");

      const idx = parseInt(el?.dataset?.index ?? "0", 10);
      setActiveDot(Number.isFinite(idx) ? idx : 0);
    }

    function closestCard() {
      const rect = viewport.getBoundingClientRect();
      const center = rect.left + rect.width / 2;

      let best = allCards[0];
      let bestDist = Infinity;

      allCards.forEach((card) => {
        const r = card.getBoundingClientRect();
        const c = r.left + r.width / 2;
        const d = Math.abs(center - c);
        if (d < bestDist) {
          bestDist = d;
          best = card;
        }
      });

      return best;
    }

    // ----------------------------
    // Active card tracking (mobile-proof) using IntersectionObserver
    // ----------------------------
    let io = null;

    function setupCenterObserver() {
      if (!("IntersectionObserver" in window)) return;

      // Kill any old observer
      if (io) io.disconnect();

      // A vertical "center band" in the viewport.
      // Only the card intersecting this band becomes active.
      io = new IntersectionObserver(
        (entries) => {
          // Pick the most-intersecting card inside the center band
          let bestEl = null;
          let bestRatio = 0;

          for (const e of entries) {
            if (!e.isIntersecting) continue;
            if (e.intersectionRatio > bestRatio) {
              bestRatio = e.intersectionRatio;
              bestEl = e.target;
            }
          }

          if (bestEl) setActiveCard(bestEl);
        },
        {
          root: viewport,
          // shrink the root so only the middle ~10% counts as "active zone"
          rootMargin: "0px -45% 0px -45%",
          threshold: [0, 0.25, 0.5, 0.75, 1],
        }
      );

      allCards.forEach((c) => io.observe(c));
    }

    setupCenterObserver();


    // ----------------------------
    // Scroll to element centered
    // ----------------------------
    function scrollToEl(el, smooth) {
      if (!el) return;

      const vRect = viewport.getBoundingClientRect();
      const cRect = el.getBoundingClientRect();

      const cardCenterFromViewportLeft =
        (cRect.left - vRect.left) + (cRect.width / 2);

      const targetLeft =
        viewport.scrollLeft +
        cardCenterFromViewportLeft -
        (vRect.width / 2);

      viewport.scrollTo({ left: targetLeft, behavior: smooth ? "smooth" : "auto" });
      setActiveCard(el);
    }

    // Compute the scrollLeft that would center a given card
    function centerScrollLeftForCard(cardEl) {
      const vRect = viewport.getBoundingClientRect();
      const cRect = cardEl.getBoundingClientRect();
      const cardCenterFromViewportLeft =
        (cRect.left - vRect.left) + (cRect.width / 2);

      return viewport.scrollLeft + cardCenterFromViewportLeft - (vRect.width / 2);
    }

    // Go to the NEAREST copy (clone/original) of a logical index
    function goToNearestLogical(logicalIndex, smooth) {
      const candidates = allCards.filter(
        (c) => (parseInt(c.dataset.index, 10) || 0) === logicalIndex
      );
      if (!candidates.length) return null;

      const current = viewport.scrollLeft;

      let best = candidates[0];
      let bestDist = Infinity;

      for (const el of candidates) {
        const target = centerScrollLeftForCard(el);
        const dist = Math.abs(target - current);
        if (dist < bestDist) {
          bestDist = dist;
          best = el;
        }
      }

      scrollToEl(best, smooth);
      return best; //return the exact element we scrolled to
    }

    function goToNearestLogicalDirectional(logicalIndex, dir, smooth) {
      // for arrows: must move in a wheel direction
      const candidates = allCards
        .filter((c) => (parseInt(c.dataset.index, 10) || 0) === logicalIndex)
        .map((el) => ({ el, target: centerScrollLeftForCard(el) }));

      if (!candidates.length) return;

      const current = viewport.scrollLeft;

      // Prefer candidates that are in the intended direction
      const directional = candidates.filter(({ target }) =>
        dir < 0 ? target < current - 1 : target > current + 1
      );

      const pool = directional.length ? directional : candidates;

      let best = pool[0];
      let bestDist = Infinity;

      for (const item of pool) {
        const dist = Math.abs(item.target - current);
        if (dist < bestDist) {
          bestDist = dist;
          best = item;
        }
      }

      // If we had to fall back (wrong side), recenter instantly then retry once
      if (!directional.length) {
        recenterNow(); // defined below
        return goToNearestLogicalDirectional(logicalIndex, dir, smooth);
      }

      scrollToEl(best.el, smooth);
    }

    function recenterNow() {
      if (isRecentering) return;

      const setW = oneSetWidth();
      let left = viewport.scrollLeft;

      // Force back into the middle band immediately
      if (left < setW * 0.5) left += setW;
      else if (left > setW * 1.5) left -= setW;
      else return;

      isRecentering = true;

      const prev = viewport.style.scrollBehavior;
      viewport.style.scrollBehavior = "auto";
      viewport.scrollLeft = left;
      viewport.style.scrollBehavior = prev;

      requestAnimationFrame(() => {
        isRecentering = false;
      });
    }

    // ----------------------------
    // Recenter (INVISIBLE) — only when scrolling stops
    // ----------------------------
    function recenterIfNeededIdle() {
      if (isRecentering) return;

      const setW = oneSetWidth();
      const left = viewport.scrollLeft;

      // Wider safe zone = fewer recenters = no hiccups
      let newLeft = null;
      if (left < setW * 0.25) newLeft = left + setW;
      else if (left > setW * 1.75) newLeft = left - setW;

      if (newLeft == null) return;

      isRecentering = true;

      // Force instant jump (no smooth)
      const prev = viewport.style.scrollBehavior;
      viewport.style.scrollBehavior = "auto";
      viewport.scrollLeft = newLeft;
      viewport.style.scrollBehavior = prev;

      requestAnimationFrame(() => {
        isRecentering = false;
      });
    }

    // ----------------------------
    // Buttons (wheel step)
    // ----------------------------
    function step(dir) {
      // Ensure we're not near the physical edges before stepping
      recenterNow();

      const currentCard = closestCard();
      const logical = parseInt(currentCard?.dataset?.index ?? "0", 10) || 0;
      const nextLogical = (logical + dir + n) % n;

      goToNearestLogicalDirectional(nextLogical, dir, true);
    }

    // ----------------------------
    // Init
    // ----------------------------
    buildDots();

    // Start on the "middle" set so user can go both ways
    requestAnimationFrame(() => {
      // IMPORTANT: hard reset first (beats scroll restoration + cached positions)
      viewport.style.scrollBehavior = "auto";
      viewport.scrollLeft = 0;

      // jump into the safe middle band (exact, not +=)
      viewport.scrollLeft = oneSetWidth();

      // center logical 0 instantly
      goToNearestLogical(0, false);

      // lock dot/card state to 0
      setActiveDot(0);
      const first = allCards.find(c => (parseInt(c.dataset.index, 10) || 0) === 0);
      if (first) setActiveCard(first);

      // one more frame to ensure transforms/classes are correct after layout
      requestAnimationFrame(() => {
        recenterNow();
        setActiveCard(closestCard());
      });
    });

    // ----------------------------
    // Scroll handling (mobile snap-safe)
    // ----------------------------
    let settleRAF = null;
    let stableFrames = 0;
    let lastLeft = viewport.scrollLeft;

    function settleAfterScroll() {
      if (settleRAF) cancelAnimationFrame(settleRAF);

      stableFrames = 0;
      lastLeft = viewport.scrollLeft;

      const tick = () => {
        const now = viewport.scrollLeft;

        // tiny epsilon so we don't get stuck on sub-pixel changes
        if (Math.abs(now - lastLeft) < 0.5) stableFrames++;
        else stableFrames = 0;

        lastLeft = now;

        // Wait until it's been stable for a few frames (snap finished)
        if (stableFrames >= 6) {
          settleRAF = null;
          const c = closestCard();
          setActiveCard(c);
          recenterIfNeededIdle();
          return;
        }

        settleRAF = requestAnimationFrame(tick);
      };

      settleRAF = requestAnimationFrame(tick);
    }

    viewport.addEventListener("scroll", () => {
      if (isRecentering) return;

      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        // Don't call setActiveCard here anymore — observer does it
        recenterIfNeededIdle();
      }, 120);
    });


    // Also kick settle when the user finishes a gesture (helps iOS)
    viewport.addEventListener("touchend", settleAfterScroll, { passive: true });
    viewport.addEventListener("pointerup", settleAfterScroll, { passive: true });


    // ----------------------------
    // Controls
    // ----------------------------
    prevBtn?.addEventListener("click", () => step(-1));
    nextBtn?.addEventListener("click", () => step(1));

    viewport.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      }
    });

    // ----------------------------
    // Resize: keep same logical card centered
    // ----------------------------
    window.addEventListener("resize", () => {
      const cur = closestCard();
      const logical = parseInt(cur?.dataset?.index ?? "0", 10) || 0;

      requestAnimationFrame(() => {
        // Re-anchor around middle
        viewport.scrollLeft = oneSetWidth();
        goToNearestLogical(logical, false);
        setActiveCard(closestCard());
      });
    });
  }
}

// ================================
// Contact form (Formspree) -> redirect to custom thanks page
// ================================
const contactForm = document.getElementById("contactForm");
const formStatus = document.getElementById("formStatus");

contactForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const btn = contactForm.querySelector('button[type="submit"]');
  const originalText = btn?.textContent;

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Sending...";
    }
    if (formStatus) formStatus.textContent = "";

    const formData = new FormData(contactForm);

    const res = await fetch(contactForm.action, {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
      },
    });

    if (res.ok) {
      // Redirect to custom page on success
      window.location.href = "thanks.html";
      return;
    }

    // If Formspree returns validation/other error
    const data = await res.json().catch(() => null);
    const msg =
      data?.errors?.[0]?.message ||
      "Something went wrong. Please try again or email me directly.";

    if (formStatus) formStatus.textContent = msg;
  } catch (err) {
    if (formStatus) {
      formStatus.textContent =
        "Network error. Please try again or email me directly.";
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText || "Send";
    }
  }
});

// ================================
// Contact form – 200 word limit
// ================================

const textarea = document.querySelector('textarea[name="message"]');
const wordCount = document.getElementById('wordCount');
const MAX_WORDS = 200;

if (textarea && wordCount) {
  textarea.addEventListener('input', () => {
    const words = textarea.value
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length > MAX_WORDS) {
      textarea.value = words.slice(0, MAX_WORDS).join(' ');
    }

    wordCount.textContent = `${words.length} / ${MAX_WORDS} words`;
  });
}
