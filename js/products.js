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

function applySearch(query) {
  const q = query.toLowerCase();
  if (!q) {
    render(products);
    return;
  }
  const filtered = products.filter(function (p) {
    return p.name.toLowerCase().includes(q) ||
           p.brand.toLowerCase().includes(q) ||
           p.category.toLowerCase().includes(q);
  });
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