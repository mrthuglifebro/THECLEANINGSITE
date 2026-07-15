const HOME_MESS_ICONS = {
  mold: '<svg class="mess-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="14" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1" fill="currentColor" stroke="none"/></svg>',
  wine: '<svg class="mess-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3h8l-1 6a3 3 0 0 1-6 0L8 3z"/><path d="M12 9v6"/><path d="M9 20h6l-1-5H10l-1 5z"/></svg>',
  grease: '<svg class="mess-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3c3 3 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 3-7 6-10z"/></svg>',
  pet: '<svg class="mess-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l6 6M20 4l-6 6M12 10v10"/><circle cx="12" cy="10" r="3"/></svg>'
};

const HOME_MESS_LABELS = {
  mold: 'Mold &amp; mildew',
  wine: 'Wine &amp; stains',
  grease: 'Grease &amp; grime',
  pet: 'Pet messes'
};

function homeProductThumb(p) {
  if (p.image) {
    return `<img src="${p.image}" alt="${p.name}" loading="lazy">`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 2h6v3l2 2v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7l2-2V2z"/><path d="M7 11h10"/></svg>`;
}

async function loadHomepage() {
  const messGrid = document.getElementById('mess-grid');
  const productGrid = document.getElementById('home-product-grid');
  if (!messGrid && !productGrid) return;

  let products = [];
  try {
const { data, error } = await supabaseClient
  .from("products")
  .select("*");

if (error) throw error;

products = data.map(p => ({
  ...p,
  sizeOz: p.size_oz,
  buyUrl: p.buy_url
}));
  } catch (err) {
    return;
  }

  if (messGrid) {
    const messKeys = Object.keys(HOME_MESS_LABELS);
    messGrid.innerHTML = messKeys.map(function (key) {
      const count = products.filter(function (p) { return p.messes.includes(key); }).length;
      return `
        <a href="fix-mess.html" class="mess-card">
          ${HOME_MESS_ICONS[key]}
          <h3>${HOME_MESS_LABELS[key]}</h3>
          <span>${count} product${count === 1 ? '' : 's'} tested</span>
        </a>
      `;
    }).join('');
  }

  if (productGrid) {
    let ratings = {};
    try {
      ratings = await fetchRatingsMap(products.map(function (p) { return p.id; }));
    } catch (err) {
      ratings = {};
    }

    // "Top" = highest real average rating among products that actually have
    // reviews. Products with no reviews yet sort to the back instead of
    // being ranked by a made-up number.
    const top = products.slice().sort(function (a, b) {
      const ra = ratings[a.id] && ratings[a.id].count > 0 ? ratings[a.id].avg : -1;
      const rb = ratings[b.id] && ratings[b.id].count > 0 ? ratings[b.id].avg : -1;
      return rb - ra;
    }).slice(0, 3);

    productGrid.innerHTML = top.map(function (p) {
      const costPerUse = (p.price / p.sizeOz).toFixed(2);
      return `
        <div class="product-card">
          <div class="product-thumb">${homeProductThumb(p)}</div>
          <div class="product-body">
            <div class="product-brand">${p.brand}</div>
            <div class="product-name">${p.name}</div>
            <div class="product-meta">
              <span class="product-price">$${costPerUse} / oz</span>
              ${ratingBadgeHTML(ratings[p.id])}
            </div>
            <a href="product.html?id=${p.id}" class="section-link" style="display:block;margin-top:12px">See Product Details →</a>
          </div>
        </div>
      `;
    }).join('');
  }
}

document.addEventListener('DOMContentLoaded', loadHomepage);