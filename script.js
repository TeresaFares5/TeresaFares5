// ============================================================
// script.js (FULL REWRITE) — Keeps existing behaviour + adds
// REAL projects filter (removes/restores cards by rebuilding)
// ============================================================

// ================================
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
// Projects Carousel (Rebuildable + Infinite Clones)
// ================================

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

// Global state so we can safely destroy/re-init on filtering
const ProjectsCarouselState = {
  inited: false,
  io: null,
  settleRAF: null,
  idleTimer: null,
  isRecentering: false,
  cleanup: null,
};

// Utility: remove listeners cleanly
function on(el, event, handler, options) {
  el?.addEventListener(event, handler, options);
  return () => el?.removeEventListener(event, handler, options);
}

function initProjectsCarousel() {
  const viewport = document.getElementById("projectsViewport");
  const track = document.getElementById("projectsTrack");
  if (!viewport || !track) return;

  // Clean up previous init (important when filtering rebuilds)
  if (ProjectsCarouselState.cleanup) {
    try { ProjectsCarouselState.cleanup(); } catch {}
  }
  if (ProjectsCarouselState.io) {
    try { ProjectsCarouselState.io.disconnect(); } catch {}
    ProjectsCarouselState.io = null;
  }
  if (ProjectsCarouselState.settleRAF) {
    cancelAnimationFrame(ProjectsCarouselState.settleRAF);
    ProjectsCarouselState.settleRAF = null;
  }
  if (ProjectsCarouselState.idleTimer) {
    clearTimeout(ProjectsCarouselState.idleTimer);
    ProjectsCarouselState.idleTimer = null;
  }

  const prevBtn = document.querySelector(".carousel-btn.prev");
  const nextBtn = document.querySelector(".carousel-btn.next");
  const dotsWrap = document.getElementById("projectsDots");

  // Remove any clones currently in the DOM (defensive)
  track.querySelectorAll(".carousel-card.is-clone").forEach((c) => c.remove());

  // Real cards only (before cloning)
  const originals = Array.from(track.querySelectorAll(".carousel-card"));
  const n = originals.length;

  if (n < 1) {
    // No cards after filtering — just clear dots
    if (dotsWrap) dotsWrap.innerHTML = "";
    return;
  }

  // Tag originals with logical index (0..n-1)
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

  // Prepend head clones (reverse so order remains correct)
  headClones
    .slice()
    .reverse()
    .forEach((c) => track.insertBefore(c, track.firstChild));

  // Append tail clones
  tailClones.forEach((c) => track.appendChild(c));

  // Now includes clones + originals
  const allCards = Array.from(track.querySelectorAll(".carousel-card"));

  // ----------------------------
  // Measurements
  // ----------------------------
  function getGapPx() {
    const cs = getComputedStyle(track);
    const g = parseFloat(cs.gap || cs.columnGap || "0");
    return Number.isFinite(g) ? g : 0;
  }

  function getCardW() {
    // Use first original as base
    return originals[0].getBoundingClientRect().width;
  }

  function oneSetWidth() {
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
  // Active tracking using IntersectionObserver
  // ----------------------------
  function setupCenterObserver() {
    if (!("IntersectionObserver" in window)) return;

    if (ProjectsCarouselState.io) {
      try { ProjectsCarouselState.io.disconnect(); } catch {}
    }

    const io = new IntersectionObserver(
      (entries) => {
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
        rootMargin: "0px -45% 0px -45%",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    allCards.forEach((c) => io.observe(c));
    ProjectsCarouselState.io = io;
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

  function centerScrollLeftForCard(cardEl) {
    const vRect = viewport.getBoundingClientRect();
    const cRect = cardEl.getBoundingClientRect();
    const cardCenterFromViewportLeft =
      (cRect.left - vRect.left) + (cRect.width / 2);

    return viewport.scrollLeft + cardCenterFromViewportLeft - (vRect.width / 2);
  }

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
    return best;
  }

  function recenterNow() {
    if (ProjectsCarouselState.isRecentering) return;

    const setW = oneSetWidth();
    let left = viewport.scrollLeft;

    // Force back into the middle band immediately
    if (left < setW * 0.5) left += setW;
    else if (left > setW * 1.5) left -= setW;
    else return;

    ProjectsCarouselState.isRecentering = true;

    const prev = viewport.style.scrollBehavior;
    viewport.style.scrollBehavior = "auto";
    viewport.scrollLeft = left;
    viewport.style.scrollBehavior = prev;

    requestAnimationFrame(() => {
      ProjectsCarouselState.isRecentering = false;
    });
  }

  function recenterIfNeededIdle() {
    if (ProjectsCarouselState.isRecentering) return;

    const setW = oneSetWidth();
    const left = viewport.scrollLeft;

    let newLeft = null;
    if (left < setW * 0.25) newLeft = left + setW;
    else if (left > setW * 1.75) newLeft = left - setW;

    if (newLeft == null) return;

    ProjectsCarouselState.isRecentering = true;

    const prev = viewport.style.scrollBehavior;
    viewport.style.scrollBehavior = "auto";
    viewport.scrollLeft = newLeft;
    viewport.style.scrollBehavior = prev;

    requestAnimationFrame(() => {
      ProjectsCarouselState.isRecentering = false;
    });
  }

  function goToNearestLogicalDirectional(logicalIndex, dir, smooth) {
    const candidates = allCards
      .filter((c) => (parseInt(c.dataset.index, 10) || 0) === logicalIndex)
      .map((el) => ({ el, target: centerScrollLeftForCard(el) }));

    if (!candidates.length) return;

    const current = viewport.scrollLeft;

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

    if (!directional.length) {
      recenterNow();
      return goToNearestLogicalDirectional(logicalIndex, dir, smooth);
    }

    scrollToEl(best.el, smooth);
  }

  function step(dir) {
    recenterNow();

    const currentCard = closestCard();
    const logical = parseInt(currentCard?.dataset?.index ?? "0", 10) || 0;
    const nextLogical = (logical + dir + n) % n;

    goToNearestLogicalDirectional(nextLogical, dir, true);
  }

  // ----------------------------
  // Settle after scroll (snap-safe)
  // ----------------------------
  function settleAfterScroll() {
    if (ProjectsCarouselState.settleRAF) cancelAnimationFrame(ProjectsCarouselState.settleRAF);

    let stableFrames = 0;
    let lastLeft = viewport.scrollLeft;

    const tick = () => {
      const now = viewport.scrollLeft;

      if (Math.abs(now - lastLeft) < 0.5) stableFrames++;
      else stableFrames = 0;

      lastLeft = now;

      if (stableFrames >= 6) {
        ProjectsCarouselState.settleRAF = null;
        const c = closestCard();
        setActiveCard(c);
        recenterIfNeededIdle();
        return;
      }

      ProjectsCarouselState.settleRAF = requestAnimationFrame(tick);
    };

    ProjectsCarouselState.settleRAF = requestAnimationFrame(tick);
  }

  // ----------------------------
  // Init + listeners
  // ----------------------------
  buildDots();

  // Start on the "middle" set so user can go both ways
  requestAnimationFrame(() => {
    viewport.style.scrollBehavior = "auto";
    viewport.scrollLeft = 0;

    viewport.scrollLeft = oneSetWidth();

    // center logical 0 instantly
    goToNearestLogical(0, false);

    // lock dot/card state to 0
    setActiveDot(0);

    // Prefer the REAL card with index=0 (not a clone)
    const firstReal = originals.find((c) => (parseInt(c.dataset.index, 10) || 0) === 0);
    if (firstReal) setActiveCard(firstReal);

    requestAnimationFrame(() => {
      recenterNow();
      setActiveCard(closestCard());
    });
  });

  const unsubs = [];

  unsubs.push(
    on(viewport, "scroll", () => {
      if (ProjectsCarouselState.isRecentering) return;

      if (ProjectsCarouselState.idleTimer) clearTimeout(ProjectsCarouselState.idleTimer);
      ProjectsCarouselState.idleTimer = setTimeout(() => {
        recenterIfNeededIdle();
      }, 120);
    })
  );

  // Helps iOS / touch snap settling
  unsubs.push(on(viewport, "touchend", settleAfterScroll, { passive: true }));
  unsubs.push(on(viewport, "pointerup", settleAfterScroll, { passive: true }));

  unsubs.push(on(prevBtn, "click", () => step(-1)));
  unsubs.push(on(nextBtn, "click", () => step(1)));

  unsubs.push(
    on(viewport, "keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      }
    })
  );

  unsubs.push(
    on(window, "resize", () => {
      const cur = closestCard();
      const logical = parseInt(cur?.dataset?.index ?? "0", 10) || 0;

      requestAnimationFrame(() => {
        viewport.scrollLeft = oneSetWidth();
        goToNearestLogical(logical, false);
        setActiveCard(closestCard());
      });
    })
  );

  ProjectsCarouselState.cleanup = () => {
    // Disconnect observer
    if (ProjectsCarouselState.io) {
      try { ProjectsCarouselState.io.disconnect(); } catch {}
      ProjectsCarouselState.io = null;
    }

    // Cancel timers/raf
    if (ProjectsCarouselState.idleTimer) {
      clearTimeout(ProjectsCarouselState.idleTimer);
      ProjectsCarouselState.idleTimer = null;
    }
    if (ProjectsCarouselState.settleRAF) {
      cancelAnimationFrame(ProjectsCarouselState.settleRAF);
      ProjectsCarouselState.settleRAF = null;
    }

    // Remove listeners
    unsubs.forEach((fn) => {
      try { fn(); } catch {}
    });
  };

  ProjectsCarouselState.inited = true;
}

// ================================
// REAL Projects Filter (remove + restore)
// ================================
document.addEventListener("DOMContentLoaded", () => {
  const filterWrap = document.querySelector(".projects-filter");
  const track = document.getElementById("projectsTrack");

  if (!track) return;

  // Snapshot the ORIGINAL cards ONCE (before any cloning)
  // Your HTML initially has no clones, so this is safe.
  const ORIGINAL_CARDS = Array.from(track.querySelectorAll(".carousel-card")).map((c) =>
    c.cloneNode(true)
  );

  const normalizeTags = (tagString) =>
    (tagString || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

  function setActiveChip(key) {
    if (!filterWrap) return;
    const chips = Array.from(filterWrap.querySelectorAll(".filter-chip"));
    chips.forEach((c) => c.classList.toggle("is-active", c.dataset.filter === key));
  }

  function rebuildTrack(filterKey) {
    // Stop current carousel listeners/observer cleanly
    if (ProjectsCarouselState.cleanup) {
      try { ProjectsCarouselState.cleanup(); } catch {}
    }
    ProjectsCarouselState.cleanup = null;

    // Clear track fully (removes clones and active states)
    track.innerHTML = "";

    const nextCards =
      filterKey === "all"
        ? ORIGINAL_CARDS
        : ORIGINAL_CARDS.filter((card) => {
            const tags = normalizeTags(card.getAttribute("data-tags"));
            return tags.includes(filterKey);
          });

    // Put matching cards back (fresh nodes)
    nextCards.forEach((c) => track.appendChild(c.cloneNode(true)));

    // Re-init carousel on the new set
    initProjectsCarousel();
  }

  // Hook filter UI if it exists, otherwise just init carousel
  if (filterWrap) {
    const chips = Array.from(filterWrap.querySelectorAll(".filter-chip"));
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const key = chip.dataset.filter || "all";
        setActiveChip(key);
        rebuildTrack(key);
      });
    });

    // Default
    setActiveChip("all");
    rebuildTrack("all");
  } else {
    // No filter UI present: just init carousel once
    initProjectsCarousel();
  }
});

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
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      window.location.href = "thanks.html";
      return;
    }

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
document.addEventListener("DOMContentLoaded", () => {
  const textarea = document.querySelector('textarea[name="message"]');
  const wordCount = document.getElementById("wordCount");
  const form = document.getElementById("contactForm");
  const sendBtn = form ? form.querySelector('button[type="submit"]') : null;

  const MAX_WORDS = 200;
  const WARN_AT = 180;

  if (!textarea || !wordCount || !sendBtn) return;

  const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length;

  const clampToMaxWords = (text) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length <= MAX_WORDS) return text;
    return words.slice(0, MAX_WORDS).join(" ");
  };

  const updateUI = () => {
    const clamped = clampToMaxWords(textarea.value);
    // keep your behaviour: clamp only when over
    if (countWords(textarea.value) > MAX_WORDS) {
      textarea.value = clamped;
    }

    const wordsNow = textarea.value.trim() ? countWords(textarea.value) : 0;
    wordCount.textContent = `${wordsNow} / ${MAX_WORDS} words`;

    wordCount.classList.toggle(
      "near-limit",
      wordsNow >= WARN_AT && wordsNow < MAX_WORDS
    );
    wordCount.classList.toggle("at-limit", wordsNow >= MAX_WORDS);

    sendBtn.disabled = wordsNow >= MAX_WORDS;
  };

  textarea.addEventListener("input", updateUI);
  updateUI();
});
