/* Story charts: redrawn in D3 from the proposal's static figures. */
const C = {
  ink: "#1d2b33", muted: "#56646c", rule: "#cfd6d8",
  ember: "#c2410c", emberSoft: "#f0b497", indigo: "#2f3e8f", plum: "#6b2368", grey: "#a7b1b5"
};

function frame(sel, w, h, m) {
  const svg = d3.select(sel).append("svg")
    .attr("class", "chart").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img");
  const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
  return { svg, g, iw: w - m.l - m.r, ih: h - m.t - m.b };
}

function chartPremiums(data) {
  const { svg, g, iw, ih } = frame("#chart-premiums", 600, 320, { t: 16, r: 56, b: 30, l: 48 });
  svg.attr("aria-label", "Line chart: average premium rose from $945 in 2008 to $1,787 in 2023");
  const x = d3.scaleLinear().domain([2008, 2023]).range([0, iw]);
  const y = d3.scaleLinear().domain([800, 1900]).range([ih, 0]);
  g.append("rect").attr("x", x(2017)).attr("width", iw - x(2017)).attr("height", ih).attr("fill", "#f6e4dc");
  g.append("text").attr("x", x(2017) + 6).attr("y", 14).text("After the 2017–18 fires");
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")).tickSizeOuter(0));
  g.append("g").attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => "$" + d3.format(",")(d)).tickSize(-iw))
    .call(a => a.select(".domain").remove())
    .call(a => a.selectAll("line").attr("stroke", "#e8ecec"));
  g.append("path").datum(data).attr("fill", "none").attr("stroke", C.ember).attr("stroke-width", 2.5)
    .attr("d", d3.line().x(d => x(d.year)).y(d => y(d.value)));
  g.selectAll("circle").data(data).join("circle")
    .attr("cx", d => x(d.year)).attr("cy", d => y(d.value)).attr("r", 3).attr("fill", C.ember);
  const last = data[data.length - 1];
  g.append("text").attr("class", "val").attr("x", x(last.year) + 8).attr("y", y(last.value) + 4)
    .text("$" + d3.format(",")(last.value));
}

function chartDistance(data) {
  const { svg, g, iw, ih } = frame("#chart-distance", 600, 300, { t: 20, r: 10, b: 30, l: 10 });
  svg.attr("aria-label", "Bar chart: non-renewal rate falls from 11.4% inside burn areas to 8.9% beyond 30 km");
  const x = d3.scaleBand().domain(data.map(d => d.bucket)).range([0, iw]).padding(0.22);
  const y = d3.scaleLinear().domain([0, 12.5]).range([ih, 0]);
  g.selectAll("rect").data(data).join("rect")
    .attr("x", d => x(d.bucket)).attr("width", x.bandwidth())
    .attr("y", d => y(d.rate)).attr("height", d => ih - y(d.rate))
    .attr("fill", (d, i) => i === 0 ? C.ember : C.emberSoft);
  g.selectAll(".val").data(data).join("text").attr("class", "val").attr("text-anchor", "middle")
    .attr("x", d => x(d.bucket) + x.bandwidth() / 2).attr("y", d => y(d.rate) - 6).text(d => d.rate.toFixed(1) + "%");
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(8)).call(a => a.select(".domain").attr("stroke", C.ink));
}

function chartPolicies(data) {
  const { svg, g, iw, ih } = frame("#chart-policies", 600, 300, { t: 16, r: 110, b: 30, l: 48 });
  svg.attr("aria-label", "Line chart: in 2023 non-renewals (788 thousand) exceeded new policies (724 thousand)");
  const x = d3.scalePoint().domain(data.map(d => d.year)).range([0, iw]).padding(0.2);
  const y = d3.scaleLinear().domain([700, 1120]).range([ih, 0]);
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).tickSizeOuter(0));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickSize(-iw))
    .call(a => a.select(".domain").remove()).call(a => a.selectAll("line").attr("stroke", "#e8ecec"));
  [["new", C.indigo, "New policies"], ["nonrenewals", C.ember, "Non-renewals"]].forEach(([k, col, label]) => {
    g.append("path").datum(data).attr("fill", "none").attr("stroke", col).attr("stroke-width", 2.5)
      .attr("d", d3.line().x(d => x(d.year)).y(d => y(d[k])));
    g.selectAll(".pt-" + k).data(data).join("circle").attr("r", 4).attr("fill", col)
      .attr("cx", d => x(d.year)).attr("cy", d => y(d[k]));
    const last = data[data.length - 1];
    g.append("text").attr("class", "series-label").attr("fill", col).style("fill", col)
      .attr("x", x(last.year) + 10).attr("y", y(last[k]) + 4).text(`${label} ${last[k]}k`);
  });
}

function chartZips(data, onPick) {
  const rowH = 26;
  const { svg, g, iw } = frame("#chart-zips", 600, data.length * rowH + 50, { t: 24, r: 20, b: 26, l: 150 });
  svg.attr("aria-label", "Dumbbell chart of non-renewal rates in 2020 and 2023 for twelve ZIP codes");
  const x = d3.scaleLinear().domain([0, 50]).range([0, iw]);
  const ih = data.length * rowH;
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => d + "%").tickSizeOuter(0));
  g.append("circle").attr("cx", 0).attr("cy", -14).attr("r", 5).attr("fill", C.grey);
  g.append("text").attr("x", 9).attr("y", -10).text("2020");
  g.append("circle").attr("cx", 56).attr("cy", -14).attr("r", 5).attr("fill", C.plum);
  g.append("text").attr("x", 65).attr("y", -10).text("2023");

  const row = g.selectAll(".zip-row").data(data).join("g")
    .attr("class", "zip-row").attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", d => `Show ZIP ${d.zip} on the map`)
    .attr("transform", (d, i) => `translate(0,${i * rowH + rowH / 2})`)
    .on("click", (e, d) => onPick(d.zip))
    .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(d.zip); } });
  row.append("rect").attr("class", "zip-hit").attr("x", -146).attr("y", -rowH / 2 + 1)
    .attr("width", iw + 146).attr("height", rowH - 2).attr("fill", "transparent");
  row.append("text").attr("class", "zip-label").attr("x", -10).attr("y", 4).attr("text-anchor", "end")
    .text(d => `${d.zip}, ${d.county}`);
  row.append("line").attr("x1", d => x(d.r2020)).attr("x2", d => x(d.r2023))
    .attr("stroke", "#d5dbdd").attr("stroke-width", 3);
  row.append("circle").attr("cx", d => x(d.r2020)).attr("r", 5).attr("fill", C.grey);
  row.append("circle").attr("cx", d => x(d.r2023)).attr("r", 5).attr("fill", C.plum);
}

function chartCauses(data) {
  const rowH = 24;
  const { svg, g, iw } = frame("#chart-causes", 600, data.length * rowH + 40, { t: 6, r: 40, b: 28, l: 120 });
  svg.attr("aria-label", "Bar chart of acres burned by cause; lightning leads with 9 million acres");
  const ih = data.length * rowH;
  const x = d3.scaleLinear().domain([0, 9.5]).range([0, iw]);
  const y = d3.scaleBand().domain(data.map(d => d.cause)).range([0, ih]).padding(0.2);
  const strong = new Set(["Lightning", "Power line"]);
  g.selectAll("rect").data(data).join("rect")
    .attr("y", d => y(d.cause)).attr("height", y.bandwidth()).attr("width", d => x(d.acres))
    .attr("fill", d => strong.has(d.cause) ? C.ember : C.emberSoft);
  g.selectAll(".val").data(data).join("text").attr("class", "val")
    .attr("x", d => x(d.acres) + 5).attr("y", d => y(d.cause) + y.bandwidth() / 2 + 4)
    .text(d => d.acres >= 0.1 ? d.acres.toFixed(1) + "M" : "<0.1M");
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0).tickPadding(8))
    .call(a => a.select(".domain").attr("stroke", C.ink));
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => d ? d + "M" : "0").tickSizeOuter(0));
}

function drawStoryCharts(statewide, onPickZip) {
  chartPremiums(statewide.premiums);
  chartDistance(statewide.distance);
  chartPolicies(statewide.policies);
  chartZips(statewide.zipChange, onPickZip);
  chartCauses(statewide.causes);
}
