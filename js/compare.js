function productThumb(p) {
  if (p.image) {
    return `<img src="${p.image}" alt="${p.name}" loading="lazy" style="width:100%;height:160px;object-fit:contain;background:#ffffff;border:1px solid var(--gray-light);border-radius:8px;margin-bottom:16px;padding:12px">`;
  }
  return '';
}

async function loadComparePage() {
  const selectA = document.getElementById('compare-a');
  const selectB = document.getElementById('compare-b');
  const resultBox = document.getElementById('compare-result');
  if (!selectA || !selectB) return;

  let products = [];
  let ratings = {};

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
    resultBox.innerHTML = '<p style="color:#64748b">Could not load products right now.</p>';
    return;
  }

  try {
    ratings = await fetchRatingsMap(products.map(function (p) { return p.id; }));
  } catch (err) {
    ratings = {};
  }

  const options = products.map(function (p) {
    return `<option value="${p.id}">${p.name}</option>`;
  }).join('');

  selectA.innerHTML = '<option value="">Select a product…</option>' + options;
  selectB.innerHTML = '<option value="">Select a product…</option>' + options;

  function renderColumn(p) {
    if (!p) {
      return '<div class="compare-col"><p style="color:#64748b">Select a product above</p></div>';
    }
    const costPerUse = (p.price / p.sizeOz).toFixed(2);
    return `
      <div class="compare-col">
        ${productThumb(p)}
        <div class="product-brand">${p.brand}</div>
        <div class="product-name" style="font-size:20px;margin-bottom:16px">${p.name}</div>
        <table class="compare-table">
          <tr><td>Price</td><td>$${p.price.toFixed(2)}</td></tr>
          <tr><td>Size</td><td>${p.sizeOz} oz</td></tr>
          <tr><td>Cost per oz</td><td>$${costPerUse}</td></tr>
          <tr><td>Verdict Score</td><td>${ratingTextPlain(ratings[p.id])}</td></tr>
          <tr><td>Category</td><td>${p.category}</td></tr>
          <tr><td>Ingredients</td><td>${p.ingredients.join(', ')}</td></tr>
        </table>
        <a href="${p.buyUrl}" target="_blank" rel="noopener sponsored" class="nav-cta" style="display:block;text-align:center;margin-top:16px">Buy | $${p.price.toFixed(2)}</a>
      </div>
    `;
  }

  function update() {
    const productA = products.find(function (p) { return p.id === selectA.value; });
    const productB = products.find(function (p) { return p.id === selectB.value; });
    resultBox.innerHTML = renderColumn(productA) + renderColumn(productB);
  }

  selectA.addEventListener('change', update);
  selectB.addEventListener('change', update);
  update();
}

document.addEventListener('DOMContentLoaded', loadComparePage);