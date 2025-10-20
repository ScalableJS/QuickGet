# Icons

This directory contains the icon assets for the QuickGet Remote browser extension.

## Structure

- **sources/** - Source SVG files (master copies)
- **{size}_download.png** - Generated PNG icons at different resolutions (32x32, 48x48, 96x96, 128x128)

## Icon Source

The main download icon is defined in `sources/download-source.svg` and features:
- Cyan/sky-blue (#0ea5e9) background with rounded corners
- White download arrow pointing downward
- White horizontal line representing the destination

## Generating Icons

To regenerate PNG icons from the SVG source, run:

```bash
npm run generate-icons
```

This will automatically create PNG versions at the following resolutions:
- **32x32** - Tab/address bar icon
- **48x48** - Small context menu icon
- **96x96** - Extension management page
- **128x128** - Chrome Web Store and large displays

## Icon Sizes

The generated icons are used in `manifest.json` as follows:

```json
{
  "icons": {
    "32": "icons/32_download.png",
    "48": "icons/48_download.png", 
    "96": "icons/96_download.png",
    "128": "icons/128_download.png"
  }
}
```

## Design Guidelines

When modifying the icon source:
- Maintain the 24x24 viewBox for consistency
- Keep the cyan background color (#0ea5e9) for brand recognition
- Ensure the white strokes are clear and visible
- Test at smaller sizes (32x32) to ensure clarity

## Tools

Icons are generated using [Sharp](https://sharp.pixelplumbing.com/), a high-performance image processing library for Node.js.
