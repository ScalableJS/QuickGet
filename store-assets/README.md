# Chrome Web Store assets

The PNGs in this directory are generated from the real extension popup connected to the E2E mock NAS. They intentionally contain only fictional download data.

Regenerate after a UI or listing change:

```bash
npm run capture:store-assets
```

Before upload, review each image and the text in [`../CHROMEWEBSTORE.md`](../CHROMEWEBSTORE.md). The assets are English because the first listing locale is English.
