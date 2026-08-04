# tools

## og-card.html

Source for `public/og.png`, the social sharing card. The chart paths are real
Washington DC data for 2026, generated once and pasted in, so the card shows the
product rather than a sketch.

Re-render after editing:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --screenshot=public/og.png tools/og-card.html
```

Keep it at 1200x630. Facebook, LinkedIn and X all accept that ratio, and X needs
it for `summary_large_image`.
