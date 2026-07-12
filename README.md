# TheCleaningVerdict (starter site)

A plain HTML/CSS/JS starter for your cleaning product site. No build tools, no frameworks — just open `index.html` in a browser to preview it.

## What's here

- `index.html` — homepage
- `products.html` — product database page (placeholder for now)
- `fix-mess.html` — "fix this mess" lookup page (placeholder for now)
- `compare.html` — product comparison page (placeholder for now)
- `css/styles.css` — all the styling
- `js/main.js` — mobile menu behavior

## Pushing this to your GitHub repo

Open a terminal in this folder and run these commands one at a time (replace `YOUR-REPO-URL` with your repo's URL, found under the green "Code" button on GitHub):

```
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin YOUR-REPO-URL
git push -u origin main
```

If your GitHub folder already has a `.git` set up (it was created from GitHub directly), skip `git init` and `git remote add` and just run:

```
git add .
git commit -m "Initial site"
git push
```

## Previewing it live later

Once it's pushed, you can connect the repo to Vercel or Netlify (both free) to get a live URL — they auto-detect a plain HTML site with no configuration needed. I can walk you through that step whenever you're ready.

## Next steps

- Swap the sample products, mess categories, and site name for real ones
- Build out `products.html`, `fix-mess.html`, and `compare.html` with real data
- Once there's real content, we can talk about where the product data should actually live (a simple JSON file is enough for v1 — no database needed yet)

