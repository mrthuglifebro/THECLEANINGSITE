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

  try {
    const response = await fetch('data/products-v2.json');
    products = await response.json();
  } catch (err) {
    grid.innerHTML = '<p style="color:#64748b">Could not load products right now.</p>';
    return;
  }

  function render(list) {
    if (list.length === 0) {
      grid.innerHTML = '<p style="color:#64748b">No products match that search.</p>';
      return;
    }

    grid.innerHTML = list.map(function (p) {
      const costPerUse = (p.price / p.sizeOz).toFixed(2);
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
              <span class="product-rating">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.4 7 0.7-5.3 4.7 1.6 6.9L12 17.3 5.8 20.7l1.6-6.9L2.1 9.1l7-0.7z"/></svg>
                ${p.rating}
              </span>
            </div>
            <a href="${p.buyUrl}" target="_blank" rel="noopener sponsored" class="nav-cta" style="display:block;text-align:center;margin-top:14px">Buy — $${p.price.toFixed(2)}</a>
          </div>
        </div>
      `;
    }).join('');
  }

  render(products);

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      const q = searchInput.value.toLowerCase();
      const filtered = products.filter(function (p) {
        return p.name.toLowerCase().includes(q) ||
               p.brand.toLowerCase().includes(q) ||
               p.category.toLowerCase().includes(q);
      });
      render(filtered);
    });
  }
}

document.addEventListener('DOMContentLoaded', loadProducts);