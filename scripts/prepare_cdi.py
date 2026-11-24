"""
Turns the CDI ZIP-level wildfire/insurance tables into data/zip_stats.csv,
replacing the placeholder values.

Source: https://www.insurance.ca.gov/01-consumers/200-wrr/DataAnalysisOnWildfiresAndInsurance.cfm

The CDI workbooks change layout between releases, so edit COLUMN_MAP to match
the headers in the file you downloaded, then run:
    pip install pandas openpyxl
    python scripts/prepare_cdi.py path/to/cdi_file.xlsx [sheet name]

Output columns the site expects:
    zip, county, year, avg_premium, nonrenewal_rate, source
avg_premium may be blank if your table has no premium column; the map shows
"No data" for blanks instead of failing.
"""
import sys
import pandas as pd

COLUMN_MAP = {               # your header  ->  site field
    "ZIP Code": "zip",
    "Year": "year",
    "Insurer-Initiated Nonrenewals": "nonrenewals",
    "Total Policies In Force": "policies",
    "Average Premium": "avg_premium",
}

path = sys.argv[1]
sheet = sys.argv[2] if len(sys.argv) > 2 else 0
df = pd.read_excel(path, sheet_name=sheet).rename(columns=COLUMN_MAP)
df["zip"] = df["zip"].astype(str).str.zfill(5)

if "nonrenewal_rate" not in df and {"nonrenewals", "policies"} <= set(df):
    df["nonrenewal_rate"] = (100 * df["nonrenewals"] / df["policies"]).round(1)
if "avg_premium" not in df:
    df["avg_premium"] = None

counties = pd.read_csv("scripts/zip_county.csv", dtype={"ZCTA5CE10": str})
counties = counties.rename(columns={"ZCTA5CE10": "zip", "name": "county"})[["zip", "county"]]
out = df.merge(counties, on="zip", how="left")
out["source"] = "cdi"
out = out[["zip", "county", "year", "avg_premium", "nonrenewal_rate", "source"]]
out.to_csv("data/zip_stats.csv", index=False)
print(f"Wrote {len(out)} rows for {out.zip.nunique()} ZIPs")
