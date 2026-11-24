#!/usr/bin/env bash
# Converts the CAL FIRE "California Fire Perimeters (all)" GeoJSON into a small
# TopoJSON the site can load (data/fire_perimeters.topo.json).
#
# 1. Download the GeoJSON from
#    https://catalog.data.gov/dataset/california-fire-perimeters-all
# 2. Run from the repo root:  bash scripts/prepare_fires.sh path/to/perimeters.geojson
# Needs Node.js (uses npx mapshaper, no install required).
set -e
IN="${1:?Pass the path to the CAL FIRE perimeters GeoJSON}"
npx -y mapshaper "$IN" \
  -proj wgs84 \
  -filter 'YEAR_ >= 2015 && YEAR_ <= 2023 && GIS_ACRES >= 100' \
  -each 'year=+YEAR_, name=FIRE_NAME, acres=Math.round(GIS_ACRES), cause=+CAUSE' \
  -filter-fields year,name,acres,cause \
  -simplify 4% keep-shapes \
  -rename-layers fires \
  -o data/fire_perimeters.topo.json format=topojson quantization=1e5
ls -lh data/fire_perimeters.topo.json
