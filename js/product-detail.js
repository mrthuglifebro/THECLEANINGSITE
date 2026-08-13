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

let allReviews = [];

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

function attachLikeHandlers() {
  reviewList.querySelectorAll('.like-btn').forEach(function (btn) {
    if (btn.dataset.listenerAttached === 'true') {
      return;
    }
    btn.dataset.listenerAttached = 'true';

    btn.addEventListener('click', async function () {
      const reviewId = btn.dataset.reviewId;
      const likedSet = getLikedSet();

      if (likedSet.has(reviewId) || btn.disabled) {
        return;
      }

      btn.disabled = true;

      const { error } = await supabaseClient
        .from('review_likes')
        .insert([{ review_id: reviewId }]);

      if (!error) {
        likedSet.add(reviewId);
        saveLikedSet(likedSet);

        const review = allReviews.find(function (r) { return r.id === reviewId; });
        if (review) review.like_count = (review.like_count || 0) + 1;

        renderFiltered();
      } else {
        btn.disabled = false;
      }
    });
  });
}

function renderFiltered() {
    const filterSelect = document.getElementById('review-filter');
    const minRating = filterSelect ? parseFloat(filterSelect.value) : 0;
    const filtered = minRating > 0
      ? allReviews.filter(function (r) { return r.rating >= minRating; })
      : allReviews;

    if (allReviews.length === 0) {
      reviewList.innerHTML = '<p style="color:#64748b">No verdicts yet, be the first to leave one.</p>';
      return;
    }

    const avg = (allReviews.reduce(function (sum, r) { return sum + r.rating; }, 0) / allReviews.length).toFixed(1);

    // Community verdict synthesis
    const wouldBuyCount = allReviews.filter(function (r) { return r.would_buy_again === true; }).length;
    const workedFirstCount = allReviews.filter(function (r) { return r.worked_first_try === true; }).length;
    const wouldBuyPct = Math.round((wouldBuyCount / allReviews.length) * 100);
    const workedFirstPct = Math.round((workedFirstCount / allReviews.length) * 100);

    const bestForList = allReviews
      .filter(function (r) { return r.best_for; })
      .map(function (r) { return r.best_for; });

    const messCounts = {};
    allReviews.forEach(function (r) {
      if (r.mess_used_on) messCounts[r.mess_used_on] = (messCounts[r.mess_used_on] || 0) + 1;
    });
    const topMess = Object.keys(messCounts).sort(function (a, b) { return messCounts[b] - messCounts[a]; })[0];

    const communityVerdict = `
      <div style="background:var(--deep);color:white;border-radius:14px;padding:24px;margin-bottom:24px">
        <p style="font-family:'Space Grotesk',sans-serif;font-size:13px;letter-spacing:0.05em;opacity:0.7;margin-bottom:8px">COMMUNITY VERDICT</p>
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:16px">
          <span style="font-family:'Space Grotesk',sans-serif;font-size:40px;font-weight:700">${avg}</span>
          <span style="opacity:0.7;font-size:14px">from ${allReviews.length} verdict${allReviews.length === 1 ? '' : 's'}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:${bestForList.length > 0 || topMess ? '16px' : '0'}">
          <div style="background:rgba(255,255,255,0.1);border-radius:8px;padding:12px;text-align:center">
            <div style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700">${wouldBuyPct}%</div>
            <div style="font-size:12px;opacity:0.7;margin-top:2px">would buy again</div>
          </div>
          <div style="background:rgba(255,255,255,0.1);border-radius:8px;padding:12px;text-align:center">
            <div style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700">${workedFirstPct}%</div>
            <div style="font-size:12px;opacity:0.7;margin-top:2px">worked first try</div>
          </div>
        </div>
        ${topMess ? `<p style="font-size:13px;opacity:0.8">Most used for: <strong>${topMess.charAt(0).toUpperCase() + topMess.slice(1)}</strong></p>` : ''}
        ${bestForList.length > 0 ? `<p style="font-size:13px;opacity:0.8;margin-top:4px">Community says best for: <strong>${bestForList.slice(0, 2).join(', ')}</strong></p>` : ''}
      </div>
    `;

    if (filtered.length === 0) {
      reviewList.innerHTML = communityVerdict + '<p style="color:#64748b">No verdicts match this filter.</p>';
      return;
    }

    const likedSet = getLikedSet();

    const maxVisible = 2;
    const visibleReviews = filtered.slice(0, maxVisible);
    const remainingCount = filtered.length - maxVisible;

    const cards = visibleReviews.map(function (r) {
      const isLiked = likedSet.has(r.id);
      const likeCount = r.like_count || 0;

      const beforeAfter = (r.before_image_url || r.after_image_url) ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
          ${r.before_image_url ? `
            <div>
              <p style="font-size:11px;color:var(--gray);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em">Before</p>
              <img src="${r.before_image_url}" alt="Before" class="review-thumb" data-full="${r.before_image_url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:zoom-in">
            </div>
          ` : '<div></div>'}
          ${r.after_image_url ? `
            <div>
              <p style="font-size:11px;color:var(--gray);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em">After</p>
              <img src="${r.after_image_url}" alt="After" class="review-thumb" data-full="${r.after_image_url}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:zoom-in">
            </div>
          ` : '<div></div>'}
        </div>
      ` : '';

      const oldPhotos = (r.image_urls || []).map(function (url) {
        return `<img src="${url}" alt="Review photo" class="review-thumb" data-full="${url}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;margin-right:8px;margin-top:8px;cursor:zoom-in">`;
      }).join('');

      const tags = [
        r.mess_used_on ? `Used for: <strong>${r.mess_used_on}</strong>` : null,
        r.worked_first_try !== null ? (r.worked_first_try ? 'Worked first try' : 'Needed multiple tries') : null,
        r.would_buy_again !== null ? (r.would_buy_again ? 'Would buy again' : 'Would not buy again') : null,
      ].filter(Boolean);

      return `
        <div style="border:1px solid var(--gray-light);border-radius:14px;padding:20px;margin-bottom:16px;background:white">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div>
              <strong style="font-size:16px">${r.reviewer_name}</strong>
              <p style="color:var(--gray);font-size:12px;margin-top:2px">${timeAgo(r.created_at)}</p>
            </div>
            <span style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:var(--sky)">${r.rating} <span style="font-size:13px;font-weight:400;color:var(--gray)">/ 5</span></span>
          </div>

          ${tags.length > 0 ? `
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
              ${tags.map(function (tag) {
                return `<span style="font-size:12px;padding:4px 10px;background:var(--mist);border-radius:20px;color:var(--ink)">${tag}</span>`;
              }).join('')}
            </div>
          ` : ''}

          ${r.best_for ? `<p style="font-size:13px;color:var(--gray);margin-bottom:8px">Best for: <strong style="color:var(--ink)">${r.best_for}</strong></p>` : ''}

          <p style="margin-bottom:8px;line-height:1.6">${r.comment}</p>

          ${r.wish_knew ? `<p style="font-size:13px;color:var(--gray);margin-top:8px;padding-top:8px;border-top:1px solid var(--gray-light)">Wish I knew: <em>${r.wish_knew}</em></p>` : ''}

          ${beforeAfter}
          ${oldPhotos ? `<div style="display:flex;flex-wrap:wrap">${oldPhotos}</div>` : ''}

          <button class="like-btn" data-review-id="${r.id}" style="margin-top:14px;background:${isLiked ? 'var(--mist)' : 'none'};border:1px solid ${isLiked ? 'var(--sky)' : 'var(--gray-light)'};border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;color:${isLiked ? 'var(--sky)' : 'var(--gray)'};font-weight:${isLiked ? '600' : '400'}">
            Helpful (${likeCount})
          </button>
        </div>
      `;
    }).join('');

    const seeMoreLink = remainingCount > 0
      ? `<a href="reviews.html?id=${productId}" class="section-link" style="display:block;text-align:center;margin-top:8px">See all ${filtered.length} verdicts →</a>`
      : '';

    reviewList.innerHTML = communityVerdict + cards + seeMoreLink;
    attachLikeHandlers();

    reviewList.querySelectorAll('.review-thumb').forEach(function (img) {
      img.addEventListener('click', function () {
        const lightbox = document.getElementById('image-lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        if (lightbox && lightboxImg) {
          lightboxImg.src = img.dataset.full;
          lightbox.style.display = 'flex';
        }
      });
    });
  }

  async function loadReviews() {
    reviewList.innerHTML = '<p style="color:#64748b">Loading reviews...</p>';

    const { data, error } = await supabaseClient
      .from('reviews')
      .select('*, review_likes(count)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      reviewList.innerHTML = '<p style="color:#64748b">Could not load reviews right now.</p>';
      return;
    }

    allReviews = data.map(function (r) {
      return Object.assign({}, r, {
        like_count: (r.review_likes && r.review_likes[0] && r.review_likes[0].count) || 0
      });
    });

    renderFiltered();
  }

  const reviewFilterSelect = document.getElementById('review-filter');
  if (reviewFilterSelect) {
    reviewFilterSelect.addEventListener('change', renderFiltered);
  }

// Populate mess picker
  const messPicker = document.getElementById('mess-picker');
  const messOptions = ['mold', 'wine', 'grease', 'pet', 'coffee', 'soap', 'hardwater', 'rust', 'dust', 'hair', 'food', 'trash', 'glass', 'bathroom', 'kitchen', 'laundry'];
  let selectedMess = null;

  if (messPicker) {
    messOptions.forEach(function (mess) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = mess.charAt(0).toUpperCase() + mess.slice(1);
      btn.style.cssText = 'padding:6px 12px;border:1px solid var(--gray-light);border-radius:20px;background:none;cursor:pointer;font-size:13px;font-family:inherit';
      btn.addEventListener('click', function () {
        selectedMess = mess;
        messPicker.querySelectorAll('button').forEach(function (b) {
          b.style.background = 'none';
          b.style.borderColor = 'var(--gray-light)';
          b.style.color = 'var(--ink)';
        });
        btn.style.background = 'var(--mist)';
        btn.style.borderColor = 'var(--sky)';
        btn.style.color = 'var(--sky)';
      });
      messPicker.appendChild(btn);
    });
  }

  // Wizard state
  let currentStep = 1;
  const totalSteps = 5;
  const answers = {
    worked_first_try: null,
    would_buy_again: null
  };

  const stepNumEl = document.getElementById('wizard-step-num');
  const backBtn = document.getElementById('wizard-back');
  const nextBtn = document.getElementById('wizard-next');
  const dots = document.querySelectorAll('.wizard-dot');
  
  function showStep(n) {
    for (let i = 1; i <= totalSteps; i++) {
      const el = document.getElementById('step-' + i);
      if (el) el.style.display = i === n ? 'block' : 'none';
    }
    if (stepNumEl) stepNumEl.textContent = n;
    dots.forEach(function (dot, idx) {
      dot.style.background = idx < n ? 'var(--sky)' : 'var(--gray-light)';
    });
    if (backBtn) backBtn.style.display = n > 1 ? 'block' : 'none';
    if (nextBtn) nextBtn.textContent = n === totalSteps ? 'Submit Verdict' : 'Next →';
  }

  // Yes/No buttons
  document.querySelectorAll('.yes-no-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const field = btn.dataset.field;
      const value = btn.dataset.value === 'true';
      answers[field] = value;

      const siblings = btn.parentElement.querySelectorAll('.yes-no-btn');
      siblings.forEach(function (b) {
        b.style.background = 'none';
        b.style.borderColor = 'var(--gray-light)';
        b.style.color = 'var(--ink)';
        b.style.fontWeight = '400';
      });
      btn.style.background = 'var(--mist)';
      btn.style.borderColor = 'var(--sky)';
      btn.style.color = 'var(--sky)';
      btn.style.fontWeight = '600';
    });
  });

  // Before/after preview
  function setupImagePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;
    input.addEventListener('change', function () {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`;
      };
      reader.readAsDataURL(file);
    });
  }

  setupImagePreview('before-upload', 'before-preview');
  setupImagePreview('after-upload', 'after-preview');

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', async function () {
      if (currentStep === 1) {
        const name = document.getElementById('reviewer-name').value.trim();
        const rating = parseFloat(document.getElementById('reviewer-rating').value);
        if (!name) {
          reviewStatus.textContent = 'Please enter your name.';
          reviewStatus.style.color = '#b91c1c';
          return;
        }
        if (!rating) {
          reviewStatus.textContent = 'Please select a Verdict Score.';
          reviewStatus.style.color = '#b91c1c';
          return;
        }
        reviewStatus.textContent = '';
      }

      if (currentStep === 4) {
        const comment = document.getElementById('reviewer-comment').value.trim();
        if (!comment) {
          reviewStatus.textContent = 'Please write your review.';
          reviewStatus.style.color = '#b91c1c';
          return;
        }
        const blockedWords = ['porn', 'xxx', 'onlyfans', 'nude', 'sex', 'nsfw'];
        const name = document.getElementById('reviewer-name').value.trim();
        const bestFor = document.getElementById('reviewer-best-for').value.trim();
        const wishKnew = document.getElementById('reviewer-wish-knew').value.trim();
        const combinedText = (name + ' ' + comment + ' ' + bestFor + ' ' + wishKnew).toLowerCase();
        if (blockedWords.some(function (word) { return combinedText.includes(word); })) {
          reviewStatus.textContent = 'Your review contains content that is not allowed.';
          reviewStatus.style.color = '#b91c1c';
          return;
        }
        reviewStatus.textContent = '';
      }

      if (currentStep < totalSteps) {
        currentStep++;
        showStep(currentStep);
        return;
      }

      // Submit
      nextBtn.disabled = true;
      reviewStatus.textContent = 'Uploading photos...';
      reviewStatus.style.color = 'var(--gray)';

      const name = document.getElementById('reviewer-name').value.trim();
      const rating = parseFloat(document.getElementById('reviewer-rating').value);
      const comment = document.getElementById('reviewer-comment').value.trim();
      const bestFor = document.getElementById('reviewer-best-for').value.trim();
      const wishKnew = document.getElementById('reviewer-wish-knew').value.trim();

      async function uploadImage(inputId, folder) {
        const input = document.getElementById(inputId);
        if (!input || !input.files[0]) return null;
        const file = input.files[0];
        const filePath = `${folder}/${productId}/${Date.now()}-${file.name}`;
        const { error } = await supabaseClient.storage.from('review-images').upload(filePath, file);
        if (error) return null;
        const { data } = supabaseClient.storage.from('review-images').getPublicUrl(filePath);
        return data.publicUrl;
      }

      const beforeUrl = await uploadImage('before-upload', 'before');
      const afterUrl = await uploadImage('after-upload', 'after');

      reviewStatus.textContent = 'Submitting your verdict...';

      const { error } = await supabaseClient.from('reviews').insert([{
        product_id: productId,
        reviewer_name: name,
        rating: rating,
        comment: comment,
        best_for: bestFor || null,
        wish_knew: wishKnew || null,
        mess_used_on: selectedMess || null,
        worked_first_try: answers.worked_first_try,
        would_buy_again: answers.would_buy_again,
        before_image_url: beforeUrl,
        after_image_url: afterUrl,
        image_urls: [],
        status: 'pending'
      }]);

      if (error) {
        reviewStatus.textContent = 'Something went wrong. Please try again.';
        reviewStatus.style.color = '#b91c1c';
        nextBtn.disabled = false;
        return;
      }

      reviewStatus.textContent = 'Your verdict has been submitted and is awaiting approval.';
      reviewStatus.style.color = 'var(--foam)';

      // Reset wizard
      currentStep = 1;
      showStep(1);
      document.getElementById('reviewer-name').value = '';
      document.getElementById('reviewer-rating').value = '';
      document.getElementById('reviewer-comment').value = '';
      document.getElementById('reviewer-best-for').value = '';
      document.getElementById('reviewer-wish-knew').value = '';
      selectedMess = null;
      answers.worked_first_try = null;
      answers.would_buy_again = null;
      if (messPicker) messPicker.querySelectorAll('button').forEach(function (b) {
        b.style.background = 'none';
        b.style.borderColor = 'var(--gray-light)';
        b.style.color = 'var(--ink)';
      });
      document.getElementById('before-preview').innerHTML = '<span style="color:var(--gray);font-size:13px">Tap to add</span>';
      document.getElementById('after-preview').innerHTML = '<span style="color:var(--gray);font-size:13px">Tap to add</span>';
      nextBtn.disabled = false;

      loadReviews();
    });
  }

  showStep(1);
  loadReviews();
}

document.addEventListener('DOMContentLoaded', loadProductDetail);

document.addEventListener('DOMContentLoaded', function () {
  const lightbox = document.getElementById('image-lightbox');
  if (lightbox) {
    lightbox.addEventListener('click', function () {
      lightbox.style.display = 'none';
    });
  }
});