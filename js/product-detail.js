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
  // Check auth state
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const currentUser = sessionData.session ? sessionData.session.user : null;
  const reviewForm = document.getElementById('review-form');
  const reviewStatus = document.getElementById('review-status');

  if (!productId) {
    container.innerHTML = '<p>No product selected.</p>';
    container.style.opacity = '1';
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
  container.style.opacity = '1';
  return;
}

  if (!product) {
    container.innerHTML = '<p>Product not found.</p>';
    container.style.opacity = '1';
    return;
  }

  document.title = product.name + ' | TheCleaningVerdict';

  // Fade the skeleton out, swap in real content, fade it back in
  container.style.opacity = '0';
  await new Promise(function (r) { setTimeout(r, 200); });

  const hasSize = product.sizeOz && product.sizeOz > 0;
  const costPerUse = hasSize ? (product.price / product.sizeOz).toFixed(2) : null;

  const thumb = product.image
    ? `<img src="${product.image}" alt="${product.name}" style="width:100%;height:100%;object-fit:contain">`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="var(--sky)" stroke-width="1.5" style="width:72px;height:72px"><path d="M9 2h6v3l2 2v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7l2-2V2z"/><path d="M7 11h10"/></svg>`;

  container.innerHTML = `
    <div class="product-detail-layout" style="display:grid;grid-template-columns:280px 1fr;gap:32px;align-items:start">
      <div class="product-detail-image" style="background:radial-gradient(ellipse 80% 80% at 50% 45%, #ffffff 0%, #ffffff 72%, var(--mist) 100%);border-radius:16px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;padding:24px">
        ${thumb}
      </div>
      <div>
        <div class="product-brand">${product.brand}</div>
        <h1 style="font-family:'Space Grotesk',sans-serif;font-size:32px;margin-bottom:16px">${product.name}</h1>
        <table class="compare-table" style="max-width:480px;margin-bottom:24px">
          <tr><td>Price</td><td>$${product.price.toFixed(2)}</td></tr>
          ${hasSize ? `<tr><td>Size</td><td>${product.sizeOz} oz</td></tr>` : ''}
          ${hasSize ? `<tr><td>Cost per oz</td><td>$${costPerUse}</td></tr>` : ''}
          <tr><td>Category</td><td>${product.category}</td></tr>
          ${product.ingredients && product.ingredients.length ? `<tr><td>Ingredients</td><td>${product.ingredients.join(', ')}</td></tr>` : ''}
        </table>
        <a href="${product.buyUrl}" target="_blank" rel="noopener sponsored" class="nav-cta" style="display:inline-block">Buy | $${product.price.toFixed(2)}</a>
      </div>
    </div>
  `;

  // Fade the real content in
  requestAnimationFrame(function () {
    container.style.opacity = '1';
  });

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
      if (!currentUser) {
  localStorage.setItem('loginRedirect', window.location.href);
  window.location.href = 'login.html';
  return;
}

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

        setTimeout(renderFiltered, 260);
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

    const cards = visibleReviews.map(function (r, index) {
      const isLiked = likedSet.has(r.id);
      const likeCount = r.like_count || 0;
      const delay = index * 0.08;

      const allPhotos = [
        ...(r.before_image_url ? [r.before_image_url] : []),
        ...(r.after_image_url ? [r.after_image_url] : []),
        ...(r.image_urls || [])
      ];

      const photoGrid = allPhotos.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
          ${allPhotos.map(function (url) {
            return `<img src="${url}" alt="Review photo" class="review-thumb" data-full="${url}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;cursor:zoom-in">`;
          }).join('')}
        </div>
      ` : '';

      const tags = [
        r.mess_used_on ? `Used for: <strong>${r.mess_used_on}</strong>` : null,
        r.worked_first_try !== null ? (r.worked_first_try ? 'Worked first try' : 'Needed multiple tries') : null,
        r.would_buy_again !== null ? (r.would_buy_again ? 'Would buy again' : 'Would not buy again') : null,
      ].filter(Boolean);

      return `
        <div class="reveal" style="transition-delay:${delay}s;border:1px solid var(--gray-light);border-radius:14px;padding:20px;margin-bottom:16px;background:white">
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

          ${photoGrid}
${currentUser && r.user_id === currentUser.id ? `
  <div style="display:flex;gap:8px;margin-top:12px">
    <button class="edit-review-btn" data-review-id="${r.id}" data-comment="${encodeURIComponent(r.comment)}" style="background:none;border:1px solid var(--gray-light);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;color:var(--gray)">Edit</button>
    <button class="delete-review-btn" data-review-id="${r.id}" style="background:none;border:1px solid #fecaca;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;color:#b91c1c">Delete</button>
  </div>
` : ''}
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
    if (window.initScrollReveal) window.initScrollReveal();
    attachLikeHandlers();
    // Edit handlers
    reviewList.querySelectorAll('.edit-review-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const reviewId = btn.dataset.reviewId;
        const currentComment = decodeURIComponent(btn.dataset.comment);

        const card = btn.closest('div[style*="border:1px solid"]');
        const commentEl = card.querySelector('p[style*="line-height"]') || card.querySelectorAll('p')[2];

        const editBox = document.createElement('div');
        editBox.style.cssText = 'margin-top:12px';
        editBox.innerHTML = `
          <textarea id="edit-textarea-${reviewId}" rows="4" style="width:100%;padding:10px 12px;border:1px solid var(--gray-light);border-radius:8px;font-family:inherit;margin-bottom:8px">${currentComment}</textarea>
          <div style="display:flex;gap:8px">
            <button id="save-edit-${reviewId}" class="nav-cta" style="border:none;cursor:pointer;padding:8px 16px;font-size:13px">Save</button>
            <button id="cancel-edit-${reviewId}" style="background:none;border:1px solid var(--gray-light);border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;color:var(--gray)">Cancel</button>
          </div>
          <p id="edit-status-${reviewId}" style="font-size:13px;margin-top:8px"></p>
        `;

        btn.parentElement.replaceWith(editBox);

        document.getElementById(`cancel-edit-${reviewId}`).addEventListener('click', function () {
          renderFiltered();
        });

        document.getElementById(`save-edit-${reviewId}`).addEventListener('click', async function () {
          const newComment = document.getElementById(`edit-textarea-${reviewId}`).value.trim();
          const statusEl = document.getElementById(`edit-status-${reviewId}`);

          if (!newComment) {
            statusEl.textContent = 'Review cannot be empty.';
            statusEl.style.color = '#b91c1c';
            return;
          }

          statusEl.textContent = 'Saving...';
          statusEl.style.color = 'var(--gray)';

          const { error } = await supabaseClient
            .from('reviews')
            .update({ comment: newComment })
            .eq('id', reviewId);

          if (error) {
            statusEl.textContent = 'Something went wrong. Please try again.';
            statusEl.style.color = '#b91c1c';
            return;
          }

          const review = allReviews.find(function (r) { return r.id === reviewId; });
          if (review) review.comment = newComment;
          renderFiltered();
        });
      });
    });

    // Delete handlers
    reviewList.querySelectorAll('.delete-review-btn').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Are you sure you want to delete this review? This cannot be undone.')) return;

        btn.disabled = true;
        btn.textContent = 'Deleting...';

        const reviewId = btn.dataset.reviewId;

        const { error } = await supabaseClient
          .from('reviews')
          .delete()
          .eq('id', reviewId);

        if (error) {
          btn.disabled = false;
          btn.textContent = 'Delete';
          alert('Something went wrong. Please try again.');
          return;
        }

        allReviews = allReviews.filter(function (r) { return r.id !== reviewId; });
        renderFiltered();
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
  const messOptions = ['mold', 'wine', 'grease', 'pet', 'coffee', 'soap', 'hardwater', 'rust', 'dust', 'hair', 'food', 'trash', 'glass', 'bathroom', 'kitchen', 'laundry', 'automotive'];
  let selectedMess = null;
  let otherMessText = '';

  const otherMessWrap = document.createElement('div');
  otherMessWrap.style.cssText = 'display:none;margin-top:10px;width:100%';
  otherMessWrap.innerHTML = `<input type="text" id="other-mess-input" placeholder="What mess was it?" style="width:100%;padding:10px 12px;border:1px solid var(--gray-light);border-radius:8px;font-family:inherit">`;

  if (messPicker) {
    function clearActiveStyles() {
      messPicker.querySelectorAll('button').forEach(function (b) {
        b.style.background = 'none';
        b.style.borderColor = 'var(--gray-light)';
        b.style.color = 'var(--ink)';
      });
    }

    messOptions.forEach(function (mess) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = mess.charAt(0).toUpperCase() + mess.slice(1);
      btn.style.cssText = 'padding:6px 12px;border:1px solid var(--gray-light);border-radius:20px;background:none;cursor:pointer;font-size:13px;font-family:inherit';
      btn.addEventListener('click', function () {
        selectedMess = mess;
        clearActiveStyles();
        btn.style.background = 'var(--mist)';
        btn.style.borderColor = 'var(--sky)';
        btn.style.color = 'var(--sky)';
        otherMessWrap.style.display = 'none';
      });
      messPicker.appendChild(btn);
    });

    const otherBtn = document.createElement('button');
    otherBtn.type = 'button';
    otherBtn.textContent = 'Other';
    otherBtn.style.cssText = 'padding:6px 12px;border:1px solid var(--gray-light);border-radius:20px;background:none;cursor:pointer;font-size:13px;font-family:inherit';
    otherBtn.addEventListener('click', function () {
      selectedMess = 'other';
      clearActiveStyles();
      otherBtn.style.background = 'var(--mist)';
      otherBtn.style.borderColor = 'var(--sky)';
      otherBtn.style.color = 'var(--sky)';
      otherMessWrap.style.display = 'block';
      const input = document.getElementById('other-mess-input');
      if (input) input.focus();
    });
    messPicker.appendChild(otherBtn);
    messPicker.parentElement.insertBefore(otherMessWrap, messPicker.nextSibling);

    otherMessWrap.addEventListener('input', function (e) {
      if (e.target.id === 'other-mess-input') {
        otherMessText = e.target.value.trim();
      }
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
      if (!el) continue;
      if (i === n) {
        el.style.display = 'block';
        el.style.opacity = '0';
        el.style.transform = 'translateX(14px)';
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            el.style.opacity = '1';
            el.style.transform = 'translateX(0)';
          });
        });
      } else {
        el.style.display = 'none';
      }
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

  // Photo preview (with per-photo remove button)
  let selectedPhotoFiles = [];

  function syncPhotoInput() {
    const input = document.getElementById('photo-upload');
    if (!input) return;
    const dt = new DataTransfer();
    selectedPhotoFiles.forEach(function (file) { dt.items.add(file); });
    input.files = dt.files;
  }

  function renderPhotoPreview() {
    const grid = document.getElementById('photo-preview-grid');
    if (!grid) return;
    grid.innerHTML = '';
    selectedPhotoFiles.forEach(function (file, index) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;width:80px;height:80px';
        wrap.innerHTML = `
          <img src="${e.target.result}" style="width:80px;height:80px;object-fit:cover;border-radius:8px">
          <button type="button" class="remove-photo-btn" data-index="${index}" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--ink);color:white;border:2px solid white;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0">✕</button>
        `;
        grid.appendChild(wrap);

        wrap.querySelector('.remove-photo-btn').addEventListener('click', function () {
          selectedPhotoFiles.splice(index, 1);
          syncPhotoInput();
          renderPhotoPreview();
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function setupPhotoPreview() {
    const input = document.getElementById('photo-upload');
    if (!input) return;
    input.addEventListener('change', function () {
      selectedPhotoFiles = selectedPhotoFiles.concat(Array.from(input.files));
      syncPhotoInput();
      renderPhotoPreview();
    });
  }

  setupPhotoPreview();

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
      if (!currentUser) {
  localStorage.setItem('loginRedirect', window.location.href);
  window.location.href = 'login.html';
  return;
}
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
        if (selectedMess === 'other') {
          const otherInput = document.getElementById('other-mess-input');
          otherMessText = otherInput ? otherInput.value.trim() : '';
          if (!otherMessText) {
            reviewStatus.textContent = 'Please specify what mess you used this on.';
            reviewStatus.style.color = '#b91c1c';
            return;
          }
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

      async function uploadPhotos() {
        const input = document.getElementById('photo-upload');
        if (!input || !input.files.length) return [];
        const urls = [];
        for (let i = 0; i < input.files.length; i++) {
          const file = input.files[i];
          const filePath = `photos/${productId}/${Date.now()}-${file.name}`;
          const { error } = await supabaseClient.storage.from('review-images').upload(filePath, file);
          if (error) continue;
          const { data } = supabaseClient.storage.from('review-images').getPublicUrl(filePath);
          urls.push(data.publicUrl);
        }
        return urls;
      }

      const photoUrls = await uploadPhotos();

      reviewStatus.textContent = 'Submitting your verdict...';

const { error } = await supabaseClient.from('reviews').insert([{
  product_id: productId,
  user_id: currentUser.id,
  reviewer_name: name,
        rating: rating,
        comment: comment,
        best_for: bestFor || null,
        wish_knew: wishKnew || null,
        mess_used_on: (selectedMess === 'other' ? otherMessText : selectedMess) || null,
        worked_first_try: answers.worked_first_try,
        would_buy_again: answers.would_buy_again,
        before_image_url: null,
        after_image_url: null,
        image_urls: photoUrls,
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
      otherMessText = '';
      otherMessWrap.style.display = 'none';
      const otherInputReset = document.getElementById('other-mess-input');
      if (otherInputReset) otherInputReset.value = '';
      answers.worked_first_try = null;
      answers.would_buy_again = null;
      if (messPicker) messPicker.querySelectorAll('button').forEach(function (b) {
        b.style.background = 'none';
        b.style.borderColor = 'var(--gray-light)';
        b.style.color = 'var(--ink)';
      });
      document.getElementById('photo-preview-grid').innerHTML = '';
      document.getElementById('photo-upload').value = '';
      selectedPhotoFiles = [];
      nextBtn.disabled = false;

      loadReviews();
    });
  }

  showStep(1);
  // Share button
  const shareBtn = document.getElementById('share-btn');
  const shareDropdown = document.getElementById('share-dropdown');

if (shareBtn) {
    shareBtn.addEventListener('click', function (e) {
      e.stopPropagation();
if (navigator.share) {
        const shareTitle = product ? `${product.name} on The Cleaning Verdict` : 'The Cleaning Verdict';
        const shareUrl = window.location.href;
        navigator.share({
          title: shareTitle,
          text: product ? `Check out ${product.name} on The Cleaning Verdict` : 'Check out The Cleaning Verdict',
          url: shareUrl
        }).catch(function () {});
      } else {
        shareDropdown.classList.toggle('open');
      }
    });

    document.addEventListener('click', function () {
      shareDropdown.classList.remove('open');
    });
  }

  const productUrl = window.location.href;
  const productTitle = product ? `${product.name} on The Cleaning Verdict` : 'The Cleaning Verdict';

  const copyLink = document.getElementById('copy-link');
  if (copyLink) {
    copyLink.addEventListener('click', function () {
      navigator.clipboard.writeText(productUrl).then(function () {
        copyLink.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:18px;height:18px;flex-shrink:0;color:var(--foam)"><polyline points="20 6 9 17 4 12"/></svg>
          Copied!
        `;
        copyLink.style.color = 'var(--foam)';
        setTimeout(function () {
          copyLink.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:18px;height:18px;flex-shrink:0;color:var(--gray)"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy link
          `;
          copyLink.style.color = 'var(--ink)';
        }, 2000);
      });
      shareDropdown.classList.remove('open');
    });
  }

  const shareTwitter = document.getElementById('share-twitter');
  if (shareTwitter) {
    shareTwitter.addEventListener('click', function () {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(productTitle)}&url=${encodeURIComponent(productUrl)}`, '_blank');
      shareDropdown.classList.remove('open');
    });
  }

  const shareFacebook = document.getElementById('share-facebook');
  if (shareFacebook) {
    shareFacebook.addEventListener('click', function () {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`, '_blank');
      shareDropdown.classList.remove('open');
    });
  }

  const shareWhatsapp = document.getElementById('share-whatsapp');
  if (shareWhatsapp) {
    shareWhatsapp.addEventListener('click', function () {
      window.open(`https://wa.me/?text=${encodeURIComponent(productTitle + ' ' + productUrl)}`, '_blank');
      shareDropdown.classList.remove('open');
    });
  }
  loadReviews();
}

document.addEventListener('DOMContentLoaded', loadProductDetail);

document.addEventListener('DOMContentLoaded', function () {
  const lightbox = document.getElementById('image-lightbox');
  if (lightbox) {
    lightbox.addEventListener('click', function () {
      lightbox.classList.remove('open');
      setTimeout(function () { lightbox.style.display = 'none'; }, 250);
    });
  }
});