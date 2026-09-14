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

## Deploy

Push to `main`; the GitHub Actions workflow builds and publishes to GitHub Pages. Set repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable cloud sync (schema in `supabase/schema.sql`).

## Credits

Game data © Nintendo / Creatures / GAME FREAK, extracted via pret/pokefirered. Sprites and text from PokeAPI. Walkthrough prose and map images from Bulbapedia (CC BY-NC-SA 2.5; map images are game screenshots © Nintendo). Fan-made, non-commercial.
