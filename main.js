/* Wildfire & insurance explorer: map, controls, tooltip, detail panel. */
(async function () {
  const W = 600, H = 700;
  const YEARS = d3.range(2015, 2024);
  const EMPTY = "#dde2e1";
  const CAUSES = {
    1: "Lightning", 2: "Equipment use", 3: "Smoking", 4: "Campfire", 5: "Debris burning",
    6: "Railroad", 7: "Arson", 8: "Playing with fire", 9: "Miscellaneous", 10: "Vehicle",
    11: "Power line", 12: "Firefighter training", 13: "Non-firefighter training", 14: "Unknown",
    15: "Structure", 16: "Aircraft", 18: "Escaped prescribed burn", 19: "Illegal campfire"
  };

  const scales = {
    premium: d3.scaleSequential(d3.interpolateLab("#e3e7f4", "#1c2766")).domain([800, 2600]).clamp(true),
    nonrenewal: d3.scaleSequential(d3.interpolateLab("#f3e8f1", "#4a1047")).domain([0, 40]).clamp(true)
  };
  const fmt$ = d => d == null || isNaN(d) ? "No data" : "$" + d3.format(",")(Math.round(d));
  const fmtPct = d => d == null || isNaN(d) ? "No data" : d.toFixed(1) + "%";

  const state = { layer: "fires", year: 2023, selected: null };

  // ---------- load ----------
  const [zipTopo, countyTopo, statsRows, statewide, fireTopo] = await Promise.all([
    d3.json("data/ca_zips.topo.json"),
    d3.json("data/ca_counties.topo.json"),
    d3.csv("data/zip_stats.csv", d3.autoType),
    d3.json("data/statewide.json"),
    d3.json("data/fire_perimeters.topo.json").catch(() => null)
  ]);
  document.getElementById("map-loading").remove();

  const zips = topojson.feature(zipTopo, zipTopo.objects.zips).features;
  const counties = topojson.feature(countyTopo, countyTopo.objects.ca_counties);
  const countyMesh = topojson.mesh(countyTopo, countyTopo.objects.ca_counties, (a, b) => a !== b);
  const outline = topojson.merge(countyTopo, countyTopo.objects.ca_counties.geometries);
  const fires = fireTopo ? topojson.feature(fireTopo, fireTopo.objects.fires).features
    .filter(f => f.properties.year >= 2015 && f.properties.year <= 2023) : [];

  const stats = new Map();
  for (const r of statsRows) {
    const z = String(r.zip).padStart(5, "0");
    if (!stats.has(z)) stats.set(z, { county: r.county, years: new Map() });
    stats.get(z).years.set(+r.year, r);
  }
  const stateAvg = new Map(statewide.premiums.map(d => [d.year, d.value]));
  const zipById = new Map(zips.map(f => [f.properties.zip, f]));

  // ---------- map ----------
  const projection = d3.geoConicEqualArea().parallels([34, 40.5]).rotate([120, 0])
    .fitExtent([[12, 12], [W - 12, H - 12]], counties);
  const path = d3.geoPath(projection);

  const svg = d3.select("#map").attr("viewBox", `0 0 ${W} ${H}`);
  const root = svg.append("g");
  root.append("path").datum(outline).attr("fill", "#f5f7f6").attr("d", path);
  const gZips = root.append("g");
  root.append("path").datum(countyMesh).attr("class", "county-mesh").attr("d", path);
  const gFires = root.append("g");
  root.append("path").datum(outline).attr("class", "state-outline").attr("d", path);

  zips.forEach(f => { f.bounds = path.bounds(f); });
  fires.forEach(f => { f.bounds = path.bounds(f); });

  const zipPaths = gZips.selectAll("path").data(zips).join("path")
    .attr("class", "zip").attr("d", path)
    .on("pointermove", onHover).on("pointerleave", hideTip)
    .on("click", (e, d) => select(d.properties.zip, { zoom: true }));

  const firePaths = gFires.selectAll("path").data(fires).join("path")
    .attr("class", "fire").attr("d", path);

  const zoom = d3.zoom().scaleExtent([1, 14]).translateExtent([[0, 0], [W, H]])
    .on("zoom", e => root.attr("transform", e.transform));
  svg.call(zoom);
  d3.select("#reset-view").on("click", () => svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity));

  function zoomTo(f) {
    const [[x0, y0], [x1, y1]] = f.bounds;
    const k = Math.min(6, 0.22 / Math.max((x1 - x0) / W, (y1 - y0) / H));
    const t = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    svg.transition().duration(750).call(zoom.transform, t);
  }

  // ---------- rendering ----------
  function value(zip, year, layer) {
    const r = stats.get(zip)?.years.get(year);
    if (!r) return null;
    return layer === "premium" ? r.avg_premium : r.nonrenewal_rate;
  }

  function render(animate = true) {
    const { layer, year } = state;
    const t = animate ? d3.transition().duration(550) : null;
    const fill = d => {
      if (layer === "fires") return "#e7ebea";
      const v = value(d.properties.zip, year, layer);
      return v == null ? EMPTY : scales[layer](v);
    };
    (t ? zipPaths.transition(t) : zipPaths).attr("fill", fill);

    const showFires = true;
    firePaths
      .attr("display", d => showFires && d.properties.year <= year ? null : "none")
      .attr("fill", d => layer !== "fires" ? "none" : d.properties.year === year ? "#c2410c" : "#f0b497")
      .attr("fill-opacity", d => d.properties.year === year ? 0.85 : 0.55)
      .attr("stroke", d => layer === "fires" ? "none" : "#c2410c")
      .attr("stroke-width", d => d.properties.year === year ? 1.4 : 0.7)
      .attr("stroke-opacity", d => d.properties.year === year ? 1 : 0.45);

    zipPaths.classed("is-selected", d => d.properties.zip === state.selected);
    zipPaths.filter(".is-selected").raise();
    drawLegend();
    if (state.selected) drawDetail(state.selected);

  }

  function drawLegend() {
    const el = d3.select("#legend").html("");
    const w = 280;
    if (state.layer === "fires") {
      const svgL = el.append("svg").attr("viewBox", `0 0 ${w} 58`).attr("width", w).style("max-width", "100%");
      svgL.append("text").attr("class", "legend-title").attr("y", 13).text("Fire perimeters, 100+ acres");
      if (!fires.length) {
        el.append("p").attr("class", "hint is-error")
          .text("Fire perimeter file not found. Run scripts/prepare_fires.sh to create data/fire_perimeters.topo.json.");
        svgL.attr("viewBox", `0 0 ${w} 20`);
        return;
      }
      [["#c2410c", `Burned in ${state.year}`], ["#f0b497", `Burned 2015–${state.year - 1}`]].forEach(([c, label], i) => {
        const g = svgL.append("g").attr("transform", `translate(${i * 135},28)`);
        g.append("rect").attr("width", 18).attr("height", 14).attr("fill", c);
        g.append("text").attr("x", 24).attr("y", 11).text(label);
      });
      const n = fires.filter(f => f.properties.year === state.year);
      const acres = d3.sum(n, f => f.properties.acres);
      el.append("p").attr("class", "hint")
        .text(`${n.length} mapped fires in ${state.year}, about ${d3.format(",")(Math.round(acres / 1000) * 1000)} acres.`);
      return;
    }
    const s = scales[state.layer];
    const [d0, d1] = s.domain();
    const svgL = el.append("svg").attr("viewBox", `0 0 ${w} 64`).attr("width", w).style("max-width", "100%");
    svgL.append("text").attr("class", "legend-title").attr("y", 13)
      .text(state.layer === "premium" ? `Average annual premium, ${state.year}` : `Policies not renewed, ${state.year}`);
    const id = "grad-" + state.layer;
    const grad = svgL.append("defs").append("linearGradient").attr("id", id);
    d3.range(0, 1.01, 0.1).forEach(t => grad.append("stop").attr("offset", t).attr("stop-color", s(d0 + t * (d1 - d0))));
    svgL.append("rect").attr("x", 0).attr("y", 22).attr("width", w - 70).attr("height", 12).attr("fill", `url(#${id})`);
    const x = d3.scaleLinear().domain([d0, d1]).range([0, w - 70]);
    svgL.append("g").attr("transform", "translate(0,36)")
      .call(d3.axisBottom(x).ticks(4).tickSize(4).tickFormat(state.layer === "premium" ? d => "$" + d3.format(",")(d) : d => d + "%"))
      .call(a => a.select(".domain").remove());
    svgL.append("rect").attr("x", w - 58).attr("y", 22).attr("width", 12).attr("height", 12).attr("fill", EMPTY);
    svgL.append("text").attr("x", w - 42).attr("y", 32).text("No data");
  }

  // ---------- tooltip ----------
  const tip = d3.select("#tooltip");
  const wrap = document.querySelector(".map-wrap");

  function onHover(event, d) {
    const z = d.properties.zip;
    const info = stats.get(z);
    const r = info?.years.get(state.year);
    const avg = stateAvg.get(state.year);
    tip.attr("hidden", null).html(`
      <h3>${z}${info?.county ? `, ${info.county} County` : ""}</h3>
      <dl>
        <dt>Avg. premium (${state.year})</dt><dd>${fmt$(r?.avg_premium)}</dd>
        <dt>State average</dt><dd>${fmt$(avg)}</dd>
        <dt>Not renewed</dt><dd>${fmtPct(r?.nonrenewal_rate)}</dd>
      </dl>
      <svg class="spark" viewBox="0 0 230 44" width="100%"></svg>
      ${r?.source === "placeholder" ? '<span class="flag">Placeholder value</span>' : ""}`);
    if (info) sparkline(tip.select(".spark"), info);
    const [px, py] = d3.pointer(event, wrap);
    const tw = 250, th = tip.node().offsetHeight;
    const left = px + 16 + tw > wrap.clientWidth ? px - tw - 12 : px + 16;
    const top = Math.max(8, Math.min(py - 20, wrap.clientHeight - th - 8));
    tip.style("left", left + "px").style("top", top + "px");
  }
  function hideTip() { tip.attr("hidden", true); }

  function sparkline(sel, info) {
    const pts = YEARS.map(y => ({ y, v: info.years.get(y)?.nonrenewal_rate })).filter(p => p.v != null);
    if (pts.length < 2) return;
    const x = d3.scaleLinear().domain([2015, 2023]).range([4, 200]);
    const y = d3.scaleLinear().domain([0, Math.max(20, d3.max(pts, p => p.v))]).range([36, 4]);
    sel.append("path").datum(pts).attr("fill", "none").attr("stroke", "#6b2368").attr("stroke-width", 1.8)
      .attr("d", d3.line().x(p => x(p.y)).y(p => y(p.v)));
    const cur = pts.find(p => p.y === state.year);
    if (cur) sel.append("circle").attr("cx", x(cur.y)).attr("cy", y(cur.v)).attr("r", 3.5).attr("fill", "#6b2368");
    sel.append("text").attr("x", 206).attr("y", 40).attr("font-size", 10).attr("fill", "#56646c").text("2023");
    sel.append("text").attr("x", 0).attr("y", 44).attr("font-size", 10).attr("fill", "#56646c").text("Non-renewals since 2015");
  }

  // ---------- detail panel ----------
  function drawDetail(z) {
    const info = stats.get(z);
    const f = zipById.get(z);
    const el = d3.select("#detail").html("");
    el.append("h3").text(`ZIP ${z}`);
    el.append("p").attr("class", "sub").text(info?.county ? `${info.county} County` : "County unknown");

    if (!info) {
      el.append("p").attr("class", "hint").text("No premium or renewal data for this ZIP yet.");
    } else {
      const r = info.years.get(state.year);
      const avg = stateAvg.get(state.year);
      const diff = r?.avg_premium && avg ? (r.avg_premium / avg - 1) * 100 : null;
      el.append("p").html(`In ${state.year}, the average premium here was <strong>${fmt$(r?.avg_premium)}</strong>` +
        (diff != null ? `, ${Math.abs(diff).toFixed(0)}% ${diff >= 0 ? "above" : "below"} the state average` : "") +
        `, and <strong>${fmtPct(r?.nonrenewal_rate)}</strong> of policies were not renewed.`);
      if ([...info.years.values()].some(d => d.source === "placeholder"))
        el.append("span").attr("class", "flag").text("Includes placeholder years");

      el.append("h4").text("Non-renewal rate, 2015–2023");
      lineChart(el, YEARS.map(y => ({ x: y, v: info.years.get(y)?.nonrenewal_rate })), null, "#6b2368", d => d + "%");
      el.append("h4").text("Average premium vs. state average");
      lineChart(el, YEARS.map(y => ({ x: y, v: info.years.get(y)?.avg_premium })),
        YEARS.map(y => ({ x: y, v: stateAvg.get(y) })), "#2f3e8f", d => d === 0 ? "$0" : "$" + d3.format(",")(d));
    }

    el.append("h4").text("Fires that reached or came near this ZIP, 2015–2023");
    if (!fires.length) {
      el.append("p").attr("class", "hint").text("Add the fire perimeter file to list nearby fires.");
      return;
    }
    const [[a0, b0], [a1, b1]] = f.bounds;
    const near = fires.filter(fi => {
      const [[c0, d0], [c1, d1]] = fi.bounds;
      return c0 <= a1 && c1 >= a0 && d0 <= b1 && d1 >= b0;
    }).sort((p, q) => q.properties.year - p.properties.year || q.properties.acres - p.properties.acres);
    if (!near.length) { el.append("p").attr("class", "hint").text("None on record."); return; }
    el.append("ul").attr("class", "fire-list").selectAll("li").data(near).join("li").html(d =>
      `<span>${d.properties.name || "Unnamed"} (${d.properties.year})</span>` +
      `<span>${d3.format(",")(d.properties.acres)} ac, ${CAUSES[d.properties.cause] || "cause unknown"}</span>`);
  }

  function lineChart(parent, series, ref, color, tickFmt) {
    const w = 300, h = 116, m = { t: 10, r: 8, b: 22, l: 44 };
    const pts = series.filter(p => p.v != null);
    if (pts.length < 2) { parent.append("p").attr("class", "hint").text("Not enough data to chart."); return; }
    const all = pts.concat(ref || []);
    const x = d3.scaleLinear().domain([2015, 2023]).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(all, p => p.v) * 1.1]).nice().range([h - m.b - 6, m.t]);
    const s = parent.append("svg").attr("viewBox", `0 0 ${w} ${h}`);
    s.append("g").attr("transform", `translate(0,${h - m.b})`)
      .call(d3.axisBottom(x).tickValues([2015, 2017, 2019, 2021, 2023]).tickFormat(d3.format("d")).tickSize(3))
      .call(a => a.select(".domain").attr("stroke", "#cfd6d8"));
    s.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(3).tickFormat(tickFmt).tickSize(3))
      .call(a => a.select(".domain").remove());
    const line = d3.line().x(p => x(p.x)).y(p => y(p.v));
    if (ref) s.append("path").datum(ref).attr("fill", "none").attr("stroke", "#a7b1b5").attr("stroke-dasharray", "4 3").attr("d", line);
    s.append("path").datum(pts).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2).attr("d", line);
    s.append("line").attr("x1", x(state.year)).attr("x2", x(state.year)).attr("y1", m.t).attr("y2", h - m.b)
      .attr("stroke", "#c2410c").attr("stroke-width", 1);
    if (ref) s.append("text").attr("x", w - m.r).attr("y", y(ref[ref.length - 1].v) - 8).attr("text-anchor", "end").text("State avg.");
  }

  // ---------- selection ----------
  function select(z, { zoom: doZoom } = {}) {
    const f = zipById.get(z);
    if (!f) return false;
    state.selected = z;
    if (doZoom) zoomTo(f);
    render(false);
    return true;
  }

  // ---------- controls ----------
  d3.selectAll('input[name="layer"]').on("change", e => { state.layer = e.target.value; render(); });
  d3.select("#zip-list").selectAll("option").data([...zipById.keys()].sort()).join("option").attr("value", d => d);
  const msg = d3.select("#zip-msg");
  d3.select("#zip-form").on("submit", e => {
    e.preventDefault();
    const z = document.getElementById("zip-input").value.trim();
    if (!/^\d{5}$/.test(z)) { msg.classed("is-error", true).text("Enter a 5-digit ZIP code."); return; }
    if (!select(z, { zoom: true })) {
      msg.classed("is-error", true).text(`ZIP ${z} isn’t on this map. Check the number, or try a nearby ZIP.`);
      return;
    }
    const c = stats.get(z)?.county;
    msg.classed("is-error", false).text(`Showing ${z}${c ? `, ${c} County` : ""}.`);
  });

  // story chart → map
  drawStoryCharts(statewide, z => {
    document.querySelector(".explorer").scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("zip-input").value = z;
    select(z, { zoom: true });
  });

  render(false);
})().catch(err => {
  console.error(err);
  const el = document.getElementById("map-loading");
  if (el) el.textContent = "The map data didn’t load. Serve the site over HTTP (GitHub Pages or `python -m http.server`), not by opening the file directly.";
});
