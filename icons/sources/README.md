# Icon Sources

This directory contains the master source files for extension icons.

## Files

### download-source.svg

The primary download icon for the QuickGet Remote extension.

**Specifications:**
- **Format:** SVG (Scalable Vector Graphics)
- **ViewBox:** 24x24
- **Canvas:** 256x256 (recommended for editing)
- **Colors:**
  - Background: Cyan (#0ea5e9)
  - Stroke/Elements: White (#ffffff)
- **Stroke Width:** 2px
- **Border Radius:** 2px

**Design Elements:**
1. **Background:** Rounded rectangle filling the canvas
2. **Arrow:** Downward-pointing arrow indicating download direction
3. **Baseline:** Horizontal line representing completion/destination

## Editing

To modify this icon:

1. Open in your preferred SVG editor (Figma, Illustrator, Inkscape, VS Code, etc.)
2. Make your changes
3. Save the file
4. Run `npm run generate-icons` to regenerate PNG versions

## Export Checklist

Before committing changes:
- [ ] Icon is clear and recognizable at 24x24 viewBox
- [ ] Colors match brand guidelines (cyan #0ea5e9, white #ffffff)
- [ ] All strokes have proper linecap and linejoin (round)
- [ ] No unnecessary elements or complexity
- [ ] File size is optimized

## Color Palette

- **Primary Brand Color:** `#0ea5e9` (Cyan/Sky Blue)
- **Text/Icons:** `#ffffff` (White)
- **Alternative Accent:** `#06b6d4` (Darker Cyan)

These colors were chosen for:
- High contrast and accessibility (WCAG AA compliant)
- Modern, friendly appearance
- Clear visibility at small sizes
