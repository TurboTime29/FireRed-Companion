# FireRed Companion

A free, offline-capable companion web app for Pokémon FireRed: step-by-step walkthrough with every trainer, item and hidden item, full Pokédex/moves/items for Gen 3, a party tracker, and a battle helper that ranks your Pokémon against any opponent.

## Run locally

```bash
npm install
npm run dev
```

## Rebuild the game data

The app's JSON in `public/data/` is generated from the [pret/pokefirered](https://github.com/pret/pokefirered) decompilation, PokeAPI CSVs and the Bulbapedia walkthrough:

```bash
python scripts/fetch_sources.py      # Bulbapedia wikitext + PokeAPI csv (pokefirered and sprites are sparse git clones under scripts/raw/)
python scripts/build_data.py         # pokemon/moves/items/trainers/locations/typechart
python scripts/build_bulba.py        # guide.json (walkthrough prose + item positions)
python scripts/build_walkthrough.py  # walkthrough.json from content/walkthrough/*.json, with coverage report
```

## Sign-in without leaving the installed app

Supabase sends a magic link. In an iOS/Android home-screen app, tapping it opens the system browser, so the session never reaches the app. Instead, Settings → Cloud sync accepts the **pasted link** (long-press → Copy Link in the mail app): the app reads the `token` (token hash) from the link and verifies it in place with `verifyOtp`. No custom SMTP or template change is required. If you do have custom SMTP, adding `{{ .Token }}` to the Magic Link template lets people paste a short code instead; the same box accepts it.

## Passkeys (Face ID / Touch ID / Windows Hello)

After the first email-code sign-in, Settings → Cloud sync offers **Add passkey on this device**; later sign-ins use **Sign in with passkey** and never leave the app. Supabase side: **Authentication → Passkeys**: enable, Relying Party ID `turbotime29.github.io`, Origins `https://turbotime29.github.io` (add `http://localhost:5173` for local dev). The client enables `auth.experimental.passkey`, which Supabase still labels experimental.

## v2 tools

- **Catch calculator** (`/catch`): exact Gen 3 formula from the decomp (ball multipliers, HP, status, Timer/Nest/Repeat/Net balls) plus the Safari Zone bait/rock model; balls you carry come from the imported save.
- **Battle helper**: full damage formula (abilities, held items, badge boosts, stat stages, burn, screens, weather, crits), KO chances from the 16 damage rolls, priority-aware speed order, Hidden Power from IVs.
- **Team coverage** (Team page): best hit per defending type, shared weaknesses, moves (TMs in your bag first) that fill gaps.
- **TM planner**, **Levels & farming**, **Held-item farming**, **Post-game**, **Breeding**, **Mechanics**, **Bag & PC** (boxes with IVs/EVs/Hidden Power), **Compare**.
- Polish: Ctrl/⌘ K quick search with recents and pinned pages (☆ in the app bar), cries, animated sprites, OLED theme, text size, per-step notes, Showdown team export.

Rebuild `public/data/extras.json` (Game Corner prizes, abilities) with `python scripts/build_extras.py`.

## Deploy

Push to `main`; the GitHub Actions workflow builds and publishes to GitHub Pages. Set repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable cloud sync (schema in `supabase/schema.sql`).

## Credits

Game data © Nintendo / Creatures / GAME FREAK, extracted via pret/pokefirered. Sprites and text from PokeAPI. Walkthrough prose and map images from Bulbapedia (CC BY-NC-SA 2.5; map images are game screenshots © Nintendo). Fan-made, non-commercial.
