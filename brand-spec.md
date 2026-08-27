# Brand spec — matt-riley.dev / Afterimage

## Identity

- Existing M/R mark: `public/favicon.svg` (preserved byte-for-byte for the overhaul).
- Voice: curious, direct, self-aware, technically exact, with room for a strange aside.
- Audience: people who want to understand what Matt makes, inspect the public source, or start a useful conversation.

## Visual bible

- Afterimage: monochrome editorial photography, bone and ink surfaces, ghosted instrument traces, one cyan signal.
- Typography: Space Grotesk for the voice; JetBrains Mono for data and code metadata.
- Materials: film grain comes from the photograph and canvas linework; no CSS gradient wallpaper, no fake paper texture.
- Interaction: smooth scroll, masked reveals, one sticky work sequence, distance based cyan pointer trail on fine pointers only.

## Asset provenance

- `public/images/afterimage/hero-workbench.webp`: generated on 2026-08-27 with `/opt/homebrew/bin/mediacreator`, provider `fal`, model `fal-ai/flux-2`. Prompt: original editorial still life photograph for a creative developer portfolio; dark workbench with CRT, abstract cyan line graph, keyboard, graph paper, notes, tools and cable; monochrome; no people, logos, or readable words; visual weight on the right with negative space on the left; photorealistic art book quality. Converted from the generated PNG to WebP with `cwebp -q 88`.
- `public/images/waffle/waffle-portrait-photo.jpg`: existing project asset supplied in the repository.
- `public/images/waffle/waffle-detail.jpg`: local crop of the existing Waffle photograph, created only to remove distracting edge UI and improve the editorial crop.
- GitHub avatar: loaded from the public GitHub profile URL by the existing build time dossier; it is optional and has a local fallback state.

## Protected contracts

- Astro static output and typed build time GitHub dossier remain.
- `#top`, `#work`, `#noise`, `#cat`, and `#exit` remain addressable.
- Day/night preference key `mr-edition` and no JavaScript data fetching remain.
