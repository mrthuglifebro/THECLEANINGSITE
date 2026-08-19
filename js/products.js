function productThumb(p) {
  if (p.image) {
    return `<img src="${p.image}" alt="${p.name}" loading="lazy">`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 2h6v3l2 2v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7l2-2V2z"/><path d="M7 11h10"/></svg>`;
}

async function loadProducts() {
  const grid = document.getElementById('product-grid');
  const searchInput = document.getElementById('product-search');
  if (!grid) return;

  let products = [];
  let ratings = {};

  try {
    const { data, error } = await supabaseClient.from('products').select('*');
    if (error) throw error;
products = data.map(p => ({
  ...p,
  sizeOz: p.size_oz,
  buyUrl: p.buy_url
}));
  products.sort(function (a, b) {
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });
  } catch (err) {
    grid.innerHTML = '<p style="color:#64748b">Could not load products right now.</p>';
    return;
  }

  try {
    ratings = await fetchRatingsMap(products.map(function (p) { return p.id; }));
  } catch (err) {
    ratings = {};
  }

  function render(list) {
    if (list.length === 0) {
      grid.innerHTML = '<p style="color:#64748b">No products match that search.</p>';
      return;
    }

    grid.innerHTML = list.map(function (p, index) {
      const hasSize = p.size_oz && p.size_oz > 0;
      const priceLabel = hasSize
        ? `$${(p.price / p.size_oz).toFixed(2)} / oz`
        : `$${p.price.toFixed(2)}`;
      const delay = Math.min(index, 8) * 0.03;
      return `
        <div class="product-card reveal" data-href="product.html?id=${p.id}" style="transition-delay:${delay}s;cursor:pointer">
          <div class="product-thumb">
            ${productThumb(p)}
          </div>
          <div class="product-body">
            <div class="product-brand">${p.brand}</div>
            <div class="product-name">${p.name}</div>
            <div class="product-meta">
              <span class="product-price">${priceLabel}</span>
              ${ratingBadgeHTML(ratings[p.id])}
            </div>
            <a href="product.html?id=${p.id}" class="section-link" style="display:block;margin-top:12px">See Product Details →</a>
            <a href="${p.buy_url}" target="_blank" rel="noopener sponsored" class="nav-cta" style="display:block;text-align:center;margin-top:10px">Buy for $${p.price.toFixed(2)}</a>
          </div>
        </div>
      `;
    }).join('');

    if (window.initScrollReveal) window.initScrollReveal();
    if (window.attachCardNav) window.attachCardNav(grid);

    // Restore the scroll position the user was at before opening a product
    const savedScroll = sessionStorage.getItem('productsScroll');
    if (savedScroll !== null) {
      // Wait for images/layout to settle so the position is accurate
      requestAnimationFrame(function () {
        window.scrollTo(0, parseInt(savedScroll, 10));
        sessionStorage.removeItem('productsScroll');
      });
    }
  }

  render(products);

const urlParams = new URLSearchParams(window.location.search);
// Priority: explicit ?q= in URL (e.g. from homepage) > remembered search
// (when returning from a product) > empty.
const savedQuery = sessionStorage.getItem('productsSearch');
const initialQuery = urlParams.get('q') || savedQuery || '';

if (searchInput) {
  searchInput.value = initialQuery;
}

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Tight typo tolerance: only allow fuzzy matches that are plausibly typos,
// not coincidental near-words. Short words allow 0-1 edits; only longer
// words allow 2, and the edit distance must stay a small fraction of the
// word length so "steam" never matches "steel"/"stain".
function isTypoMatch(queryWord, token) {
  if (token.length < 4 || queryWord.length < 4) return false;
  const dist = levenshtein(queryWord, token);
  if (dist === 0) return true;
  const maxLen = Math.max(queryWord.length, token.length);
  let allowed;
  if (maxLen <= 4) allowed = 0;
  else if (maxLen <= 6) allowed = 1;
  else allowed = 2;
  return dist > 0 && dist <= allowed;
}

// Score a single query word against one product. Returns the best score
// found across the product's weighted fields (0 = no match).
function scoreWordAgainstProduct(word, p) {
  const fields = [
    { text: (p.name || '').toLowerCase(), weight: 10 },
    { text: (p.category || '').toLowerCase(), weight: 8 },
    { text: (p.brand || '').toLowerCase(), weight: 6 },
    { text: (p.messes || []).join(' ').toLowerCase(), weight: 5 },
    { text: (p.ingredients || []).join(' ').toLowerCase(), weight: 2 }
  ];

  let best = 0;

  for (const field of fields) {
    if (!field.text) continue;
    const tokens = field.text.split(/\s+/);
    let fieldScore = 0;

    for (const token of tokens) {
      if (token === word) {
        // Exact whole-word match: strongest signal
        fieldScore = Math.max(fieldScore, field.weight * 3);
      } else if (word.length >= 3 && token.startsWith(word)) {
        // Prefix match (e.g. "steam" matches "steamer"): strong
        fieldScore = Math.max(fieldScore, field.weight * 2);
      } else if (word.length >= 4 && token.includes(word)) {
        // Substring match, only for meaningful query lengths
        fieldScore = Math.max(fieldScore, field.weight * 1.5);
      } else if (isTypoMatch(word, token)) {
        // Genuine typo tolerance: weakest positive signal
        fieldScore = Math.max(fieldScore, field.weight * 1);
      }
    }

    best = Math.max(best, fieldScore);
  }

  return best;
}

function applySearch(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    render(products);
    return;
  }

  const words = q.split(/\s+/).filter(Boolean);

  const scored = products.map(function (p) {
    let total = 0;
    let matchedWords = 0;

    words.forEach(function (word) {
      const s = scoreWordAgainstProduct(word, p);
      if (s > 0) {
        total += s;
        matchedWords += 1;
      }
    });

    return { product: p, total: total, matchedWords: matchedWords };
  });

  // Require every query word to match something (AND search), so
  // "steam cleaner" only returns products matching both words. This
  // is the key filter that removes coincidental single-word matches.
  const filtered = scored
    .filter(function (s) { return s.matchedWords === words.length && s.total > 0; })
    .sort(function (a, b) { return b.total - a.total; })
    .map(function (s) { return s.product; });

  render(filtered);
}

applySearch(initialQuery);

// The remembered search has now been applied; clear it so a later fresh
// visit (via nav) doesn't resurrect an old search. Scroll is cleared
// separately once it's been restored.
sessionStorage.removeItem('productsSearch');

if (searchInput) {
  searchInput.addEventListener('input', function () {
    applySearch(searchInput.value);
  });
}
}

document.addEventListener('DOMContentLoaded', loadProducts);

// Let our manual scroll restoration be authoritative on the products page
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Save scroll position + current search before navigating into a product,
// so returning via "Back to all products" lands the user where they left off
// with their search intact.
document.addEventListener('click', function (e) {
  const card = e.target.closest('[data-href]');
  const link = e.target.closest('a[href^="product.html"]');
  if (card || link) {
    sessionStorage.setItem('productsScroll', String(window.scrollY));
    const box = document.getElementById('product-search');
    if (box) sessionStorage.setItem('productsSearch', box.value);
  }
});