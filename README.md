# Tile website

Swipeable tiles (buttons, arrow keys and scrolling on desktop). Click or tap a tile to flip it. Hosted on GitHub Pages, styled in HSG colours, with Auto / Light / Dark switch.

## Add a tile
1. Create a file in `_tiles/`, e.g. `06-my-tile.md`. Tiles are shown in filename order, so number the files.
2. Put this in it:

```markdown
---
title: Tile title
subtitle: Optional line under the title
image: assets/img/my-picture.jpg   # optional, file lives in assets/img/
image_alt: Describe the picture    # optional
---
Everything here is the BACK of the tile (Markdown works).
```
3. Commit and push. GitHub Pages rebuilds in about a minute.

To remove a tile, delete its file. Via the GitHub web UI, use "Add file" in the `_tiles` folder.

## Publish
Push to GitHub, then Settings, Pages, "Deploy from a branch", `main` / root.

## Preview locally
```
bundle install
bundle exec jekyll serve
```
Then open http://localhost:4000. (Needs Ruby 2.7+; macOS system Ruby 2.6 is too old, use e.g. `brew install ruby`.)

## Notes
- Deployed as the user site `SolizerCodes.github.io` (no `baseurl` needed). If this ever moves to a project repo, set `baseurl: "/repo-name"` in `_config.yml`.
- Tile size adapts to the screen height (the whole tile always fits) and is capped at 420px wide, so very wide screens stay calm.
- Long text on the back scrolls; a fade and arrow at the bottom show that there is more. Front titles and subtitles are cut after two lines.

## Notes
- Deployed as the user site `SolizerCodes.github.io` (no `baseurl` needed). If this ever moves to a project repo, set `baseurl: "/repo-name"` in `_config.yml`.
- Tile size adapts to the screen height (the whole tile always fits) and is capped at 420px wide, so very wide screens stay calm.
- Long text on the back scrolls; a fade and arrow at the bottom show that there is more. Front titles and subtitles are cut after two lines.
