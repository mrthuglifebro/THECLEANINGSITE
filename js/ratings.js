// Shared helper for showing real ratings pulled from the Supabase "reviews"
// table. No page should ever show a hardcoded rating/reviewCount again |
// everything routes through here so there's exactly one source of truth.

// Fetches real average + count for a batch of product ids in one query.
// Returns a map like: { "dawn-ultra-dish": { avg: 4.6, count: 12 }, ... }
// Products with no reviews yet get { avg: null, count: 0 }.
async function fetchRatingsMap(productIds) {
  const map = {};
  productIds.forEach(function (id) {
    map[id] = { avg: null, count: 0 };
  });

  if (!productIds.length) return map;

  const { data, error } = await supabaseClient
    .from('reviews')
    .select('product_id, rating')
    .in('product_id', productIds);

  if (error || !data) {
    return map;
  }

  const sums = {};
  const counts = {};
  data.forEach(function (r) {
    sums[r.product_id] = (sums[r.product_id] || 0) + r.rating;
    counts[r.product_id] = (counts[r.product_id] || 0) + 1;
  });

  Object.keys(counts).forEach(function (id) {
    map[id] = {
      avg: sums[id] / counts[id],
      count: counts[id]
    };
  });

  return map;
}

// Small badge used on product cards (grid views). Honestly reflects "no
// reviews yet" instead of ever showing a made-up number.
function ratingBadgeHTML(ratingInfo) {
  if (!ratingInfo || ratingInfo.count === 0) {
    return '<span class="product-rating" style="color:#94a3b8;font-size:13px">No reviews yet</span>';
  }
  return `
    <span class="product-rating">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.4 7 0.7-5.3 4.7 1.6 6.9L12 17.3 5.8 20.7l1.6-6.9L2.1 9.1l7-0.7z"/></svg>
      ${ratingInfo.avg.toFixed(1)} (${ratingInfo.count})
    </span>
  `;
}

// Plain-text version used inside the compare table.
function ratingTextPlain(ratingInfo) {
  if (!ratingInfo || ratingInfo.count === 0) {
    return 'No reviews yet';
  }
  return `${ratingInfo.avg.toFixed(1)} (${ratingInfo.count} review${ratingInfo.count === 1 ? '' : 's'})`;
}