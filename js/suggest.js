document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('suggest-form');
  const status = document.getElementById('suggest-status');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const productName = document.getElementById('suggest-name').value.trim();
    const brand = document.getElementById('suggest-brand').value.trim();
    const notes = document.getElementById('suggest-notes').value.trim();
    const submittedBy = document.getElementById('suggest-submitter').value.trim();

    if (!productName) {
      status.textContent = 'Please enter at least a product name.';
      status.style.color = '#b91c1c';
      return;
    }

    status.textContent = 'Submitting…';
    status.style.color = 'var(--gray)';

    const { error } = await supabaseClient
      .from('product_suggestions')
      .insert([{
        product_name: productName,
        brand: brand || null,
        notes: notes || null,
        submitted_by: submittedBy || null
      }]);

    if (error) {
      status.textContent = 'Something went wrong submitting your suggestion. Please try again.';
      status.style.color = '#b91c1c';
      return;
    }

    status.textContent = 'Thanks! Your suggestion has been submitted.';
    status.style.color = 'var(--foam)';
    form.reset();
  });
});