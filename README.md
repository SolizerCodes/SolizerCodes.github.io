# Tile website

Swipeable cards (buttons, arrow keys and scrolling on desktop). Click or tap a card to flip it. Hosted on GitHub Pages as `SolizerCodes.github.io`, with an Auto / Light / Dark switch for the page around the cards.

## Update the cards from the slides
The cards come from a PDF export of the slides (front, back, front, back, ...).

1. In PowerPoint: File, Export, PDF. Save it over `AI-Pattern-Cards-HSG.pdf` (one folder above this one).
2. Run:
   ```
   pip install pymupdf fonttools brotli pillow     # once
   python3 tools/pdf_to_tiles.py                   # or: python3 tools/pdf_to_tiles.py path/to/cards.pdf
   ```
   This rewrites everything in `_tiles/` and `assets/img/`.
3. Commit and push. GitHub Pages rebuilds in about a minute.

What the script does: every slide becomes HTML with the text as real, selectable text (set in the free font Cabin as a stand-in for Gill Sans Nova, widths matched line by line), lines and shapes as SVG, pictures as WebP. Positions are percentages of the card and sizes scale with it, so the cards look the same on every screen. Cards keep their own colours in light and dark mode.

## Simple tiles without slides
A Markdown file in `_tiles/` also works (this is the older format). The file name decides the order:

```markdown
---
title: Tile title
subtitle: Optional line under the title
image: assets/img/my-picture.jpg   # optional
image_alt: Describe the picture    # optional
---
Everything here is the BACK of the tile (Markdown works).
```
Do not mix them up: running the script deletes everything in `_tiles/` first.

## Publish
Push to GitHub, then Settings, Pages, "Deploy from a branch", `main` / root.

## Preview locally
```
bundle install
bundle exec jekyll serve
```
Then open http://localhost:4000. (Needs Ruby 2.7+; macOS system Ruby 2.6 is too old, use e.g. `brew install ruby`.)

## Notes
- Image paths inside the generated tiles start with `/assets/...`, which is right for a user site (`SolizerCodes.github.io`). In a project repo they would need a prefix.
- The font files in `assets/fonts` are Cabin (SIL Open Font License), served from this site, so no request goes to Google.
- Tile size adapts to the screen height (the whole tile always fits) and is capped at 420px wide.
