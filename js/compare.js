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
  const verdictBox = document.getElementById('compare-verdict');
  if (!selectA || !selectB) return;

  let products = [];
  let ratings = {};

  try {
    const { data, error } = await supabaseClient.from('products').select('*');
    if (error) throw error;
    products = data.map(function (p) {
      return Object.assign({}, p, { sizeOz: p.size_oz, buyUrl: p.buy_url });
    });
  } catch (err) {
    resultBox.innerHTML = '<p style="color:#64748b">Could not load products right now.</p>';
    return;
  }

  try {
    ratings = await fetchRatingsMap(products.map(function (p) { return p.id; }));
  } catch (err) {
    ratings = {};
  }

  const byCategory = {};
  products.forEach(function (p) {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  });

  const categoryOptionsHTML = Object.keys(byCategory).sort().map(function (cat) {
    const opts = byCategory[cat].map(function (p) {
      return `<option value="${p.id}">${p.name}</option>`;
    }).join('');
    return `<optgroup label="${cat}">${opts}</optgroup>`;
  }).join('');

  selectA.innerHTML = '<option value="">Select a product…</option>' + categoryOptionsHTML;
  selectB.innerHTML = '<option value="">Pick a product on the left first</option>';
  selectB.disabled = true;

  function populateSelectB(category, excludeId) {
    const matches = byCategory[category].filter(function (p) { return p.id !== excludeId; });
    if (matches.length === 0) {
      selectB.innerHTML = '<option value="">No other products in this category yet</option>';
      selectB.disabled = true;
      return;
    }
    const opts = matches.map(function (p) {
      return `<option value="${p.id}">${p.name}</option>`;
    }).join('');
    selectB.innerHTML = '<option value="">Select a product…</option>' + opts;
    selectB.disabled = false;
  }

  function renderColumn(p, isWinner) {
    if (!p) {
      return '<div class="compare-col"><p style="color:#64748b">Select a product above</p></div>';
    }
    const costPerUse = p.sizeOz > 0 ? (p.price / p.sizeOz).toFixed(2) : null;
    return `
      <div class="compare-col">
        ${productThumb(p)}
        <div class="product-brand">${p.brand}</div>
        <div class="product-name" style="font-size:20px;margin-bottom:16px">${p.name}${isWinner ? ' 🏆' : ''}</div>
        <table class="compare-table">
          <tr><td>Price</td><td class="${p._priceWin ? 'compare-win' : ''}">$${p.price.toFixed(2)}</td></tr>
          <tr><td>Size</td><td>${p.sizeOz > 0 ? p.sizeOz + ' oz' : 'N/A'}</td></tr>
          <tr><td>Cost per oz</td><td class="${p._costWin ? 'compare-win' : ''}">${costPerUse ? '$' + costPerUse : 'None'}</td></tr>
          <tr><td>Verdict Score</td><td class="${p._scoreWin ? 'compare-win' : ''}">${ratingTextPlain(ratings[p.id])}</td></tr>
          <tr><td>Category</td><td>${p.category}</td></tr>
          <tr><td>Ingredients</td><td>${(p.ingredients || []).join(', ')}</td></tr>
        </table>
        <a href="${p.buyUrl}" target="_blank" rel="noopener sponsored" class="nav-cta" style="display:block;text-align:center;margin-top:16px">Buy — $${p.price.toFixed(2)}</a>
      </div>
    `;
  }

  function renderVerdict(a, b) {
    const ra = ratings[a.id];
    const rb = ratings[b.id];
    const aHasScore = ra && ra.count > 0;
    const bHasScore = rb && rb.count > 0;

    let winnerName = null;

    if (aHasScore && bHasScore) {
      if (ra.avg > rb.avg) winnerName = a.name;
      else if (rb.avg > ra.avg) winnerName = b.name;
      else winnerName = a.price <= b.price ? a.name : b.name;
    } else if (aHasScore && !bHasScore) {
      winnerName = a.name;
    } else if (bHasScore && !aHasScore) {
      winnerName = b.name;
    }

    if (!winnerName) {
      verdictBox.innerHTML = `<div class="verdict-banner no-verdict">Not enough Verdict Score data yet, check back once more reviews come in.</div>`;
      return;
    }

    verdictBox.innerHTML = `<div class="verdict-banner">The Verdict: <strong>${winnerName}</strong> wins this comparison</div>`;
  }

  function update() {
    const productA = products.find(function (p) { return p.id === selectA.value; });
    const productB = products.find(function (p) { return p.id === selectB.value; });

    if (!productA || !productB) {
      resultBox.innerHTML = renderColumn(productA) + renderColumn(productB);
      verdictBox.innerHTML = '';
      return;
    }

    productA._priceWin = productA.price < productB.price;
    productB._priceWin = productB.price < productA.price;

    const costA = productA.sizeOz > 0 ? productA.price / productA.sizeOz : null;
    const costB = productB.sizeOz > 0 ? productB.price / productB.sizeOz : null;
    productA._costWin = costA !== null && costB !== null && costA < costB;
    productB._costWin = costA !== null && costB !== null && costB < costA;

    const ra = ratings[productA.id];
    const rb = ratings[productB.id];
    const scoreA = ra && ra.count > 0 ? ra.avg : null;
    const scoreB = rb && rb.count > 0 ? rb.avg : null;
    productA._scoreWin = scoreA !== null && scoreB !== null && scoreA > scoreB;
    productB._scoreWin = scoreA !== null && scoreB !== null && scoreB > scoreA;

    let overallWinnerId = null;
    if (scoreA !== null && scoreB !== null) {
      if (scoreA > scoreB) overallWinnerId = productA.id;
      else if (scoreB > scoreA) overallWinnerId = productB.id;
      else overallWinnerId = productA.price <= productB.price ? productA.id : productB.id;
    } else if (scoreA !== null) {
      overallWinnerId = productA.id;
    } else if (scoreB !== null) {
      overallWinnerId = productB.id;
    }

    resultBox.innerHTML =
      renderColumn(productA, overallWinnerId === productA.id) +
      renderColumn(productB, overallWinnerId === productB.id);

    renderVerdict(productA, productB);
  }

  selectA.addEventListener('change', function () {
    const chosen = products.find(function (p) { return p.id === selectA.value; });
    resultBox.innerHTML = '';
    verdictBox.innerHTML = '';
    if (!chosen) {
      selectB.innerHTML = '<option value="">Pick a product on the left first</option>';
      selectB.disabled = true;
      return;
    }
    populateSelectB(chosen.category, chosen.id);
  });

  selectB.addEventListener('change', update);
}

document.addEventListener('DOMContentLoaded', loadComparePage);