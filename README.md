# How Wildfires Affect Insurance Premiums and Their Renewal Rates

Prototype for the DSC 209R final project: an interactive map of California ZIP codes
showing wildfire perimeters, average homeowner premiums and non-renewal rates, plus
a short story built from our static charts.

## Publish on GitHub Pages

1. Create a public repo and push everything in this folder to the `main` branch.
2. In the repo, open **Settings > Pages**, set **Source** to "Deploy from a branch",
   branch `main`, folder `/ (root)`, and save.
3. After a minute the site is live at `https://<user>.github.io/<repo>/`. Submit that URL on Canvas.

To preview locally, run `python -m http.server` in this folder and open
http://localhost:8000. Opening `index.html` directly from disk won't load the data.

## Add the fire perimeters (do this before submitting)

The repo doesn't include the fire layer yet. With Node.js installed:

```
# download the GeoJSON from https://catalog.data.gov/dataset/california-fire-perimeters-all
bash scripts/prepare_fires.sh ~/Downloads/California_Fire_Perimeters_all.geojson
```

This writes `data/fire_perimeters.topo.json` (2015–2023, fires of 100+ acres,
simplified). Commit it. Until it exists, the map shows a notice in place of the fire legend.
If the field names in your download differ from `YEAR_`, `FIRE_NAME`, `GIS_ACRES`, `CAUSE`,
edit the `-filter` and `-each` lines in the script.

## Replace placeholder ZIP data

`data/zip_stats.csv` currently holds synthetic placeholder values for most ZIPs
(`source = placeholder`). Only the 2020 and 2023 non-renewal rates for the 12 ZIPs in the
dumbbell chart are real (`source = cdi_chart`, read off our chart). To swap in the CDI tables:

```
pip install pandas openpyxl
python scripts/prepare_cdi.py path/to/cdi_workbook.xlsx "Sheet name"
```

Edit `COLUMN_MAP` at the top of the script to match the workbook's headers first.
`data/statewide.json` holds the story-chart numbers, also read off our charts; swap in exact figures when you have them.

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `style.css` | Page structure and styles |
| `main.js` | Map, layer switch, year slider, ZIP lookup, tooltip, detail panel |
| `charts.js` | The five story charts (D3) |
| `data/ca_zips.topo.json` | California ZCTA boundaries (2010 Census), simplified |
| `data/ca_counties.topo.json` | County outlines (us-atlas) |
| `data/zip_stats.csv` | ZIP x year premiums and non-renewal rates |
| `data/statewide.json` | Statewide figures for the story charts |
| `scripts/` | Data-prep scripts and the ZIP-to-county lookup |
