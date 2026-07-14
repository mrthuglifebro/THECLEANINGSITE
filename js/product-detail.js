function starDisplay(rating) {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      out += '★';
    } else if (rating >= i - 0.5) {
      out += '⯨';
    } else {
      out += '☆';
    }
  }
  return out;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return days + ' days ago';
  const months = Math.floor(days / 30);
  return months + (months === 1 ? ' month ago' : ' months ago');
}

async function loadProductDetail() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');
  const container = document.getElementById('product-detail');
  const reviewList = document.getElementById('review-list');
  const reviewForm = document.getElementById('review-form');
  const reviewStatus = document.getElementById('review-status');

  if (!productId) {
    container.innerHTML = '<p>No product selected.</p>';
    return;
  }

let product = null;

try {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  if (error) throw error;

  product = {
    ...data,
    sizeOz: data.size_oz,
    buyUrl: data.buy_url
  };
} catch (err) {
  console.error(err);
  container.innerHTML = "<p>Could not load product data.</p>";
  return;
}

  if (!product) {
    container.innerHTML = '<p>Product not found.</p>';
    return;
  }

  document.title = product.name + ' | TheCleaningVerdict';

  const costPerUse = (product.price / product.sizeOz).toFixed(2);
  container.innerHTML = `
    <div class="product-brand">${product.brand}</div>
    <h1 style="font-family:'Space Grotesk',sans-serif;font-size:32px;margin-bottom:16px">${product.name}</h1>
    <table class="compare-table" style="max-width:480px;margin-bottom:24px">
      <tr><td>Price</td><td>$${product.price.toFixed(2)}</td></tr>
      <tr><td>Size</td><td>${product.sizeOz} oz</td></tr>
      <tr><td>Cost per oz</td><td>$${costPerUse}</td></tr>
      <tr><td>Category</td><td>${product.category}</td></tr>
      <tr><td>Ingredients</td><td>${product.ingredients.join(', ')}</td></tr>
    </table>
    <a href="${product.buyUrl}" target="_blank" rel="noopener sponsored" class="nav-cta" style="display:inline-block">Buy | $${product.price.toFixed(2)}</a>
  `;

  async function loadReviews() {
    reviewList.innerHTML = '<p style="color:#64748b">Loading reviews…</p>';

    const { data, error } = await supabaseClient
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      reviewList.innerHTML = '<p style="color:#64748b">Could not load reviews right now.</p>';
      return;
    }

    if (data.length === 0) {
      reviewList.innerHTML = '<p style="color:#64748b">No reviews yet | be the first to leave one.</p>';
      return;
    }

    const avg = (data.reduce(function (sum, r) { return sum + r.rating; }, 0) / data.length).toFixed(1);
    const summary = `<p style="margin-bottom:20px"><strong>${avg} average</strong> from ${data.length} review${data.length === 1 ? '' : 's'}</p>`;

    reviewList.innerHTML = summary + data.map(function (r) {
      return `
        <div class="compare-col" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <strong>${r.reviewer_name}</strong>
            <span style="color:#f5a524">${starDisplay(r.rating)}</span>
          </div>
          <p style="color:var(--gray);font-size:13px;margin-bottom:8px">${timeAgo(r.created_at)}</p>
          <p>${r.comment}</p>
        </div>
      `;
    }).join('');
  }

  if (reviewForm) {
    reviewForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const name = document.getElementById('reviewer-name').value.trim();
const rating = parseFloat(document.getElementById('reviewer-rating').value);      
const comment = document.getElementById('reviewer-comment').value.trim();

      if (!name || !comment || !rating) {
        reviewStatus.textContent = 'Please fill out every field.';
        reviewStatus.style.color = '#b91c1c';
        return;
      }

      reviewStatus.textContent = 'Submitting…';
      reviewStatus.style.color = 'var(--gray)';

      const { error } = await supabaseClient
        .from('reviews')
        .insert([{ product_id: productId, reviewer_name: name, rating: rating, comment: comment }]);

      if (error) {
        reviewStatus.textContent = 'Something went wrong submitting your review.';
        reviewStatus.style.color = '#b91c1c';
        return;
      }

      reviewStatus.textContent = 'Review submitted, thank you!';
      reviewStatus.style.color = 'var(--foam)';
      reviewForm.reset();
      loadReviews();
    });
  }

  loadReviews();
}

document.addEventListener('DOMContentLoaded', loadProductDetail);