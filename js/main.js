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

  els.forEach(function (el) { observer.observe(el); });
}

window.initScrollReveal = initScrollReveal;
document.addEventListener('DOMContentLoaded', initScrollReveal);