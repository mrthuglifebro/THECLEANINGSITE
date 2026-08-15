function starDisplay(rating) {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) out += '★';
    else if (rating >= i - 0.5) out += '⯨';
    else out += '☆';
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

function getLikedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem('likedReviews') || '[]'));
  } catch (err) {
    return new Set();
  }
}

function saveLikedSet(set) {
  localStorage.setItem('likedReviews', JSON.stringify(Array.from(set)));
}

async function loadAllReviews() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');
  const reviewList = document.getElementById('review-list');
  const backLink = document.getElementById('back-link');
  const heading = document.getElementById('reviews-heading');
  const filterSelect = document.getElementById('review-filter');

  if (!productId) {
    reviewList.innerHTML = '<p style="color:#64748b">No product selected.</p>';
    return;
  }

  if (backLink) backLink.href = `product.html?id=${productId}`;

  reviewList.innerHTML = '<p style="color:#64748b">Loading reviews...</p>';

  let product = null;
  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('name')
      .eq('id', productId)
      .single();
    if (!error && data) {
      product = data;
      document.title = `Reviews for ${data.name} | The Cleaning Verdict`;
      if (heading) heading.textContent = `All reviews for ${data.name}`;
    }
  } catch (err) {}

  let allReviews = [];

  try {
    const { data, error } = await supabaseClient
      .from('reviews')
      .select('*, review_likes(count)')
      .eq('product_id', productId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) throw error;

    allReviews = data.map(function (r) {
      return Object.assign({}, r, {
        like_count: (r.review_likes && r.review_likes[0] && r.review_likes[0].count) || 0
      });
    });
  } catch (err) {
    reviewList.innerHTML = '<p style="color:#64748b">Could not load reviews right now.</p>';
    return;
  }

  function renderAll() {
    if (allReviews.length === 0) {
      reviewList.innerHTML = '<p style="color:#64748b">No reviews yet for this product.</p>';
      return;
    }

    const minRating = filterSelect ? parseFloat(filterSelect.value) : 0;
    const filtered = minRating > 0
      ? allReviews.filter(function (r) { return r.rating >= minRating; })
      : allReviews;

    const avg = (allReviews.reduce(function (sum, r) { return sum + r.rating; }, 0) / allReviews.length).toFixed(1);
    const summary = `<p style="margin-bottom:20px"><strong>${avg} Verdict Score</strong> from ${allReviews.length} review${allReviews.length === 1 ? '' : 's'}</p>`;

    if (filtered.length === 0) {
      reviewList.innerHTML = summary + '<p style="color:#64748b">No reviews match this filter.</p>';
      return;
    }

    const likedSet = getLikedSet();

    const cards = filtered.map(function (r, index) {
      const images = (r.image_urls || []).map(function (url) {
        return `<img src="${url}" alt="Review photo" class="review-thumb" data-full="${url}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;margin-right:8px;margin-top:8px;cursor:zoom-in">`;
      }).join('');

      const isLiked = likedSet.has(r.id);
      const likeCount = r.like_count || 0;
      const delay = Math.min(index, 10) * 0.06;

      return `
        <div class="compare-col reveal" style="margin-bottom:16px;transition-delay:${delay}s">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <strong>${r.reviewer_name}</strong>
            <span style="color:#f5a524">${starDisplay(r.rating)}</span>
          </div>
          <p style="color:var(--gray);font-size:13px;margin-bottom:8px">${timeAgo(r.created_at)}</p>
          <p>${r.comment}</p>
          ${images ? `<div style="display:flex;flex-wrap:wrap">${images}</div>` : ''}
          <button class="like-btn" data-review-id="${r.id}" style="margin-top:12px;background:${isLiked ? 'var(--mist)' : 'none'};border:1px solid ${isLiked ? 'var(--sky)' : 'var(--gray-light)'};border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;color:${isLiked ? 'var(--sky)' : 'var(--gray)'};font-weight:${isLiked ? '600' : '400'}">
            Helpful (${likeCount})
          </button>
        </div>
      `;
    }).join('');

    reviewList.innerHTML = summary + cards;
    if (window.initScrollReveal) window.initScrollReveal();

    reviewList.querySelectorAll('.like-btn').forEach(function (btn) {
      if (btn.dataset.listenerAttached === 'true') return;
      btn.dataset.listenerAttached = 'true';

      btn.addEventListener('click', async function () {
        const reviewId = btn.dataset.reviewId;
        const likedSet = getLikedSet();
        if (likedSet.has(reviewId) || btn.disabled) return;

        btn.disabled = true;
        const { error } = await supabaseClient
          .from('review_likes')
          .insert([{ review_id: reviewId }]);

        if (!error) {
          likedSet.add(reviewId);
          saveLikedSet(likedSet);
          btn.classList.add('like-pulse');
          const review = allReviews.find(function (r) { return r.id === reviewId; });
          if (review) review.like_count = (review.like_count || 0) + 1;
          setTimeout(renderAll, 260);
        } else {
          btn.disabled = false;
        }
      });
    });

    reviewList.querySelectorAll('.review-thumb').forEach(function (img) {
      img.addEventListener('click', function () {
        const lightbox = document.getElementById('image-lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        if (lightbox && lightboxImg) {
          lightboxImg.src = img.dataset.full;
          lightbox.style.display = 'flex';
          requestAnimationFrame(function () { lightbox.classList.add('open'); });
        }
      });
    });
  }

  if (filterSelect) {
    filterSelect.addEventListener('change', renderAll);
  }

  renderAll();
}

document.addEventListener('DOMContentLoaded', loadAllReviews);

document.addEventListener('DOMContentLoaded', function () {
  const lightbox = document.getElementById('image-lightbox');
  if (lightbox) {
    lightbox.addEventListener('click', function () {
      lightbox.classList.remove('open');
      setTimeout(function () { lightbox.style.display = 'none'; }, 250);
    });
  }
});