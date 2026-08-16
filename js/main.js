document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');

  if (toggle && links) {
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = links.classList.toggle('nav-open');
      toggle.classList.toggle('nav-toggle-open', isOpen);
    });

    document.addEventListener('click', function (e) {
      if (links.classList.contains('nav-open') && !links.contains(e.target) && !toggle.contains(e.target)) {
        links.classList.remove('nav-open');
        toggle.classList.remove('nav-toggle-open');
      }
    });

    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        links.classList.remove('nav-open');
        toggle.classList.remove('nav-toggle-open');
      }
    });
  }
});

// Reusable scroll-reveal: call window.initScrollReveal() any time new
// .reveal elements are added to the page (e.g. after rendering cards).
function initScrollReveal() {
  var els = document.querySelectorAll('.reveal:not(.is-visible)');
  if (!els.length) return;

  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  // Let the hidden (opacity:0) state paint first, then observe, so the
  // transition actually plays instead of snapping straight to visible.
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      els.forEach(function (el) { observer.observe(el); });
    });
  });
}

window.initScrollReveal = initScrollReveal;
document.addEventListener('DOMContentLoaded', initScrollReveal);

// Makes product cards clickable anywhere, while leaving inner links/buttons
// (Buy button, See Product Details) working normally without double-navigation.
function attachCardNav(container) {
  if (!container) return;
  container.querySelectorAll('[data-href]').forEach(function (card) {
    if (card.dataset.navAttached === 'true') return;
    card.dataset.navAttached = 'true';

    card.addEventListener('click', function (e) {
      // Ignore clicks that landed on a link, button, or anything inside one
      if (e.target.closest('a, button')) return;
      const href = card.dataset.href;
      document.body.style.transition = 'opacity 0.18s ease';
      document.body.style.opacity = '0';
      setTimeout(function () { window.location.href = href; }, 160);
    });
  });
}

window.attachCardNav = attachCardNav;

// Guard against a stuck-invisible page when returning via back/forward cache
window.addEventListener('pageshow', function () {
  document.body.style.opacity = '1';
});