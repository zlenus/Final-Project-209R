"""
Builds data/zip_stats.csv for the prototype.

Real values: non-renewal rates for 12 ZIPs in 2020 and 2023, read off the
proposal's dumbbell chart (CDI data, approximate to ~0.5 pt).
Everything else is PLACEHOLDER (source=placeholder) so the map can be
exercised end to end. Replace with scripts/prepare_cdi.py output.

Usage: python scripts/build_placeholder_stats.py scripts/zip_county.csv
"""
import csv, math, random, sys

STATE_PREMIUM = {2015: 1042, 2016: 1057, 2017: 1075, 2018: 1143, 2019: 1249,
                 2020: 1315, 2021: 1460, 2022: 1619, 2023: 1787}
YEARS = sorted(STATE_PREMIUM)

# zip: (2020 rate, 2023 rate) from the proposal chart
REAL = {"95954": (18.5, 46.7), "93518": (12.3, 39.6), "96033": (9.3, 36.0),
        "95922": (6.2, 32.4), "93271": (9.4, 31.8), "91905": (14.2, 32.9),
        "93260": (14.0, 31.6), "95379": (13.9, 29.9), "91963": (11.0, 27.0),
        "95457": (9.9, 25.6), "95542": (6.2, 20.6), "96088": (14.8, 28.3)}

src = sys.argv[1] if len(sys.argv) > 1 else "scripts/zip_county.csv"
rows = []
with open(src) as f:
    for r in csv.DictReader(f):
        z = r["ZCTA5CE10"]
        lat, lon = float(r["y"]), float(r["x"])
        rnd = random.Random(int(z))
        # crude "wildland" proxy: inland, foothill latitudes, plus noise
        inland = min(1, max(0, (lon + 123.5) / 4.0)) * (1 - min(1, max(0, (lon + 117.5) / 3)))
        risk = max(0, min(1, 0.55 * inland + 0.25 * rnd.random() + (0.2 if 36 < lat < 41 else 0)))
        for y in YEARS:
            t = (y - 2015) / 8
            nr = 4 + risk * (6 + 22 * t * t) + rnd.uniform(-1.5, 1.5)
            prem = STATE_PREMIUM[y] * (0.75 + 0.6 * risk) * rnd.uniform(0.92, 1.08)
            source = "placeholder"
            if z in REAL:
                a, b = REAL[z]
                if y == 2020: nr, source = a, "cdi_chart"
                elif y == 2023: nr, source = b, "cdi_chart"
                elif 2020 < y < 2023: nr = a + (b - a) * (y - 2020) / 3
                elif y < 2020: nr = a * (0.6 + 0.1 * (y - 2015))
            rows.append({"zip": z, "county": r["name"], "year": y,
                         "avg_premium": round(prem), "nonrenewal_rate": round(max(0, nr), 1),
                         "source": source})

with open("data/zip_stats.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader(); w.writerows(rows)
print(len(rows), "rows written")
