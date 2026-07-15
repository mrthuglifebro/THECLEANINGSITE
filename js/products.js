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
}));  } catch (err) {
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

    grid.innerHTML = list.map(function (p) {
      const costPerUse = (p.price / p.size_oz).toFixed(2);
      return `
        <div class="product-card">
          <div class="product-thumb">
            ${productThumb(p)}
          </div>
          <div class="product-body">
            <div class="product-brand">${p.brand}</div>
            <div class="product-name">${p.name}</div>
            <div class="product-meta">
              <span class="product-price">$${costPerUse} / oz</span>
              ${ratingBadgeHTML(ratings[p.id])}
            </div>
            <a href="product.html?id=${p.id}" class="section-link" style="display:block;margin-top:12px">See reviews →</a>
            <a href="${p.buy_url}" target="_blank" rel="noopener sponsored" class="nav-cta" style="display:block;text-align:center;margin-top:10px">Buy for $${p.price.toFixed(2)}</a>
          </div>
        </div>
      `;
    }).join('');
  }

  render(products);

const urlParams = new URLSearchParams(window.location.search);
const initialQuery = urlParams.get('q') || '';

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

function wordMatches(queryWord, haystackTokens) {
  for (const token of haystackTokens) {
    if (token.includes(queryWord) || queryWord.includes(token)) {
      return true;
    }
    const maxDistance = queryWord.length <= 4 ? 1 : 2;
    if (levenshtein(queryWord, token) <= maxDistance) {
      return true;
    }
  }
  return false;
}

function applySearch(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    render(products);
    return;
  }

  const words = q.split(/\s+/);

  const scored = products.map(function (p) {
    const haystackString = [
      p.name,
      p.brand,
      p.category,
      (p.ingredients || []).join(' '),
      (p.messes || []).join(' ')
    ].join(' ').toLowerCase();

    const haystackTokens = haystackString.split(/\s+/);

    const matchCount = words.filter(function (word) {
      return wordMatches(word, haystackTokens);
    }).length;

    return { product: p, matchCount };
  });

  const threshold = Math.max(1, Math.ceil(words.length / 2));
  const filtered = scored
    .filter(function (s) { return s.matchCount >= threshold; })
    .sort(function (a, b) { return b.matchCount - a.matchCount; })
    .map(function (s) { return s.product; });

  render(filtered);
}

applySearch(initialQuery);

if (searchInput) {
  searchInput.addEventListener('input', function () {
    applySearch(searchInput.value);
  });
}
}

document.addEventListener('DOMContentLoaded', loadProducts);