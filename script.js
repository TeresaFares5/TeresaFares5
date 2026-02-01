// ================================
// Smooth scroll for in-page anchors (nav links)
// ================================
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const targetId = a.getAttribute("href");

    // Ignore empty or placeholder hashes
    if (!targetId || targetId === "#") return;

    // Find the target section
    const target = document.querySelector(targetId);
    if (!target) return;

    // Prevent default jump-to-anchor behaviour
    e.preventDefault();

    // Smoothly scroll the section into view
    target.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
});

// ================================
// Back-to-top button logic
// ================================
const backToTopBtn = document.getElementById("backToTop");

// Show / hide button based on scroll position
window.addEventListener("scroll", () => {
  backToTopBtn.style.display = window.scrollY > 300 ? "flex" : "none";
});

// Smooth scroll back to the top when clicked
backToTopBtn.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});

// ================================
// Projects Carousel
// ================================
const viewport = document.getElementById("projectsViewport");
const track = document.getElementById("projectsTrack");

// Only initialise carousel if required elements exist
if (viewport && track) {
  // All carousel cards
  const cards = Array.from(track.querySelectorAll(".carousel-card"));

  // Navigation buttons
  const prevBtn = document.querySelector(".carousel-btn.prev");
  const nextBtn = document.querySelector(".carousel-btn.next");

  // --------------------------------
  // Determine which card is closest
  // to the center of the viewport
  // --------------------------------
  function getClosestCardIndex() {
    const viewportRect = viewport.getBoundingClientRect();
    const viewportCenter = viewportRect.left + viewportRect.width / 2;

    let closestIndex = 0;
    let closestDistance = Infinity;

    cards.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const dist = Math.abs(viewportCenter - cardCenter);

      if (dist < closestDistance) {
        closestDistance = dist;
        closestIndex = i;
      }
    });

    return closestIndex;
  }

  // --------------------------------
  // Apply "active" class to center card
  // --------------------------------
  function setActiveCard(index) {
    cards.forEach((c) => c.classList.remove("is-active"));
    if (cards[index]) cards[index].classList.add("is-active");
  }

  // --------------------------------
  // Scroll viewport so selected card
  // is centered horizontally
  // --------------------------------
  function scrollToCard(index) {
    const card = cards[index];
    if (!card) return;

    const viewportRect = viewport.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    // Distance from viewport left to card center,
    // plus current scroll offset
    const cardCenterFromViewportLeft =
      (cardRect.left - viewportRect.left) + (cardRect.width / 2);

    const targetScrollLeft =
      viewport.scrollLeft +
      cardCenterFromViewportLeft -
      (viewportRect.width / 2);

    viewport.scrollTo({
      left: targetScrollLeft,
      behavior: "smooth"
    });

    // Update active card styling
    setActiveCard(index);
  }

  // --------------------------------
  // Update active card when user scrolls
  // (debounced for performance)
  // --------------------------------
  let scrollTimer = null;

  viewport.addEventListener("scroll", () => {
    window.clearTimeout(scrollTimer);

    scrollTimer = window.setTimeout(() => {
      setActiveCard(getClosestCardIndex());
    }, 80);
  });

  // --------------------------------
  // Previous button behaviour
  // --------------------------------
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      const idx = getClosestCardIndex();
      scrollToCard(Math.max(0, idx - 1));
    });
  }

  // --------------------------------
  // Next button behaviour
  // --------------------------------
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const idx = getClosestCardIndex();
      scrollToCard(Math.min(cards.length - 1, idx + 1));
    });
  }

  // --------------------------------
  // Keyboard navigation support
  // --------------------------------
  viewport.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollToCard(Math.max(0, getClosestCardIndex() - 1));
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollToCard(Math.min(cards.length - 1, getClosestCardIndex() + 1));
    }
  });

  // --------------------------------
  // Initial state + responsive recalculation
  // --------------------------------
  window.addEventListener("load", () => {
    setActiveCard(getClosestCardIndex());
  });

  window.addEventListener("resize", () => {
    const idx = getClosestCardIndex();
    scrollToCard(idx);
  });
}
