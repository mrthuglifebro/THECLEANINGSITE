// Check if user is already logged in when page loads
async function getSession() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session;
}

// Update nav bar to show signed in state
async function updateNavAuth() {
  const session = await getSession();
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks) return;

  const existing = document.getElementById('nav-auth-item');
  if (existing) existing.remove();

  const li = document.createElement('li');
  li.id = 'nav-auth-item';

  if (session) {
    const email = session.user.email;
    const short = email.split('@')[0];
    li.innerHTML = `
      <span style="color:var(--gray);font-size:14px;display:flex;align-items:center;gap:8px">
        <span style="background:var(--sky);color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:600">${short[0].toUpperCase()}</span>
        <a href="#" id="sign-out-link" style="color:var(--gray);font-size:13px">Sign out</a>
      </span>
    `;
    navLinks.appendChild(li);

    const signOutLink = document.getElementById('sign-out-link');
    if (signOutLink) {
      signOutLink.addEventListener('click', async function (e) {
        e.preventDefault();
        await supabaseClient.auth.signOut();
        window.location.href = 'index.html';
      });
    }
  } else {
    li.innerHTML = `<a href="login.html" style="color:var(--gray);font-size:14px">Sign in</a>`;
    navLinks.appendChild(li);
  }
}

// Handle magic link redirect (runs on login.html after user clicks email link)
async function handleAuthRedirect() {
  if (!window.location.pathname.includes('login.html')) return;
  
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = hashParams.get('access_token');
  if (!accessToken) return;

  const { data, error } = await supabaseClient.auth.getSession();
  if (data.session) {
    const redirectTo = localStorage.getItem('loginRedirect') || 'index.html';
    localStorage.removeItem('loginRedirect');
    window.location.href = redirectTo;
  }
}

// Login form logic (only runs on login.html)
function setupLoginForm() {
  const btn = document.getElementById('login-btn');
  const emailInput = document.getElementById('login-email');
  const status = document.getElementById('login-status');
  const form = document.getElementById('login-form');
  const success = document.getElementById('login-success');
  const sentTo = document.getElementById('sent-to-email');
  if (!btn) return;

  btn.addEventListener('click', async function () {
    const email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
      status.textContent = 'Please enter a valid email address.';
      status.style.color = '#b91c1c';
      return;
    }

    btn.disabled = true;
    status.textContent = 'Sending...';
    status.style.color = 'var(--gray)';

    const { error } = await supabaseClient.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: 'https://thecleaningverdict.com/login.html'
      }
    });

    if (error) {
      status.textContent = 'Something went wrong. Please try again.';
      status.style.color = '#b91c1c';
      btn.disabled = false;
      return;
    }

    form.style.display = 'none';
    success.style.display = 'block';
    if (sentTo) sentTo.textContent = email;
  });

  emailInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') btn.click();
  });
}

document.addEventListener('DOMContentLoaded', async function () {
  await handleAuthRedirect();
  await updateNavAuth();
  setupLoginForm();
});