"use strict";

/**
 * Expense Tracker — lightweight SVG charts (line, bar, doughnut).
 * No external chart library: keeps the app fully offline and small.
 */
window.App = window.App || {};

(function (ns) {
  const C = (ns.charts = {});
  const NAMESPACE = "http://www.w3.org/2000/svg";

  C.PALETTE = [
    "#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#10b981",
    "#06b6d4", "#3b82f6", "#ef4444", "#84cc16", "#f97316",
    "#14b8a6", "#8b5cf6"
  ];

  /* ---------- helpers ---------- */
  function el(name, attrs) {
    const node = document.createElementNS(NAMESPACE, name);
    for (const [k, v] of Object.entries(attrs || {})) {
      node.setAttribute(k, v);
    }
    return node;
  }

  function aspectTextColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--text-3").trim() || "#8a91a3";
  }
  function gridTextColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--border").trim() || "#e7e9f0";
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const d = v / pow;
    const nd = d <= 1 ? 1 : d <= 2 ? 2 : d <= 5 ? 5 : 10;
    return nd * pow;
  }

  /* ---------- Line / Area chart ---------- */
  C.renderLine = function (container, series, labels, opts) {
    opts = opts || {};
    const colors = opts.colors || [C.PALETTE[0], C.PALETTE[4]];
    const hasMultiple = series.length > 1;
    const height = opts.height || 220;
    const width = container.clientWidth || 360;
    const padL = 8;
    const padR = 8;
    const padT = 14;
    const padB = 26;
    const all = series.flatMap((s) => s.values);
    let max = Math.max(0, ...all);
    max = niceMax(max * 1.15);
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const innerW = plotW / Math.max(1, labels.length - 1);

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", role: "img", "aria-label": opts.ariaLabel || "Chart" });

    // horizontal gridlines + labels
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = padT + plotH - (plotH * i) / steps;
      const line = el("line", { x1: padL, x2: width - padR, y1: y, y2: y, stroke: gridTextColor(), "stroke-width": 1 });
      svg.appendChild(line);
      const t = el("text", { x: width - padR, y: y - 4, "text-anchor": "end", "font-size": "10", fill: aspectTextColor() });
      t.textContent = ns.utils.fmtNumber(((max * i) / steps).toFixed(0));
      svg.appendChild(t);
    }

    // data lines with area fill
    if (opts.area !== false) {
      series.forEach((s, si) => {
        const pts = s.values.map((v, i) => ({
          x: padL + i * innerW,
          y: padT + plotH - (v / max) * plotH
        }));
        if (!pts.length) return;
        const defs = el("defs");
        const gid = `areaGrad${si}-${Math.floor(Math.random() * 100000)}`;
        const gradEl = el("linearGradient", { id: gid, x1: "0", y1: "0", x2: "0", y2: "1" });
        gradEl.appendChild(el("stop", { offset: "0%", "stop-color": colors[si % colors.length], "stop-opacity": "0.28" }));
        gradEl.appendChild(el("stop", { offset: "100%", "stop-color": colors[si % colors.length], "stop-opacity": "0" }));
        defs.appendChild(gradEl);
        svg.appendChild(defs);
        const areaPath = `M ${pts[0].x} ${padT + plotH} L ${pts.map((p) => `${p.x} ${p.y}`).join(" L ")} L ${pts[pts.length - 1].x} ${padT + plotH} Z`;
        const area = el("path", { d: areaPath, fill: `url(#${gid})`, stroke: "none" });
        svg.appendChild(area);
        const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        const line = el("path", {
          d: linePath, fill: "none", stroke: colors[si % colors.length],
          "stroke-width": "2.5", "stroke-linecap": "round", "stroke-linejoin": "round"
        });
        svg.appendChild(line);
        pts.forEach((p) => {
          const dot = el("circle", { cx: p.x, cy: p.y, r: 3, fill: colors[si % colors.length], stroke: "#fff", "stroke-width": "1.5" });
          svg.appendChild(dot);
        });
      });
    } else {
      series.forEach((s, si) => {
        const pts = s.values.map((v, i) => ({
          x: padL + i * innerW,
          y: padT + plotH - (v / max) * plotH
        }));
        if (!pts.length) return;
        const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        const line = el("path", {
          d: linePath, fill: "none", stroke: colors[si % colors.length],
          "stroke-width": "2.5", "stroke-linecap": "round", "stroke-linejoin": "round"
        });
        svg.appendChild(line);
      });
    }

    // x labels (sample to avoid crowding)
    const maxLabels = Math.floor(width / 44);
    const step = Math.ceil(labels.length / maxLabels);
    labels.forEach((label, i) => {
      if (i % step !== 0 && i !== labels.length - 1) return;
      const x = padL + i * innerW;
      const t = el("text", { x, y: height - 8, "text-anchor": "middle", "font-size": "10", fill: aspectTextColor() });
      t.textContent = label;
      svg.appendChild(t);
    });

    container.innerHTML = "";
    container.appendChild(svg);

    // legend when multiple series
    if (hasMultiple) {
      let legend = container.parentNode.querySelector(".chart-legend");
      if (!legend) {
        legend = document.createElement("div");
        legend.className = "chart-legend";
        container.parentNode.appendChild(legend);
      }
      legend.innerHTML = series
        .map((s, i) => `<span class="li"><span class="dot" style="background:${colors[i % colors.length]}"></span>${ns.utils.escapeHtml(s.name)}</span>`)
        .join("");
    }
  };

  /* ---------- Bar chart ---------- */
  C.renderBar = function (container, labels, values, opts) {
    opts = opts || {};
    const height = opts.height || 220;
    const width = container.clientWidth || 360;
    const padL = 8;
    const padR = 8;
    const padT = 16;
    const padB = 26;
    let max = Math.max(0, ...values);
    max = niceMax(max * 1.2) || 1;
    const plotH = height - padT - padB;
    const plotW = width - padL - padR;
    const n = labels.length;
    const slot = plotW / Math.max(1, n);
    const barW = Math.min(slot * 0.55, 36);

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", role: "img", "aria-label": opts.ariaLabel || "Bar chart" });

    for (let i = 0; i <= 4; i++) {
      const y = padT + plotH - (plotH * i) / 4;
      svg.appendChild(el("line", { x1: padL, x2: width - padR, y1: y, y2: y, stroke: gridTextColor(), "stroke-width": 1 }));
      const t = el("text", { x: width - padR, y: y - 4, "text-anchor": "end", "font-size": "10", fill: aspectTextColor() });
      t.textContent = ns.utils.fmtNumber(((max * i) / 4).toFixed(0));
      svg.appendChild(t);
    }

    const colorFn = opts.color || (() => C.PALETTE[0]);
    values.forEach((v, i) => {
      const h = (v / max) * plotH;
      const x = padL + i * slot + (slot - barW) / 2;
      const y = padT + plotH - h;
      const rect = el("rect", { x, y, width: barW, height: Math.max(h, 2), rx: 6, fill: colorFn(v, i) });
      svg.appendChild(rect);
      const t = el("text", { x: padL + i * slot + slot / 2, y: height - 8, "text-anchor": "middle", "font-size": "10", fill: aspectTextColor() });
      t.textContent = labels[i];
      svg.appendChild(t);
    });

    container.innerHTML = "";
    container.appendChild(svg);
  };

  /* ---------- Doughnut chart ---------- */
  C.renderDoughnut = function (container, items, opts) {
    opts = opts || {};
    const size = 190;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 18;
    const stroke = opts.stroke || 26;

    const svg = el("svg", { viewBox: `0 0 ${size} ${size}`, width: "100%", role: "img", "aria-label": "Doughnut chart" });

    // track
    const circumference = 2 * Math.PI * r;
    svg.appendChild(
      el("circle", { cx, cy, r, fill: "none", "stroke-width": stroke, stroke: gridTextColor() })
    );

    let cumulative = 0;
    const total = items.reduce((s, it) => s + (it.value || 0), 0);

    if (total > 0) {
      items.forEach((item, i) => {
        const frac = item.value / total;
        const dash = frac * circumference;
        const gap = circumference - dash;
        const color = item.color || C.PALETTE[i % C.PALETTE.length];
        const circle = el("circle", {
          cx, cy, r, fill: "none", stroke: color, "stroke-width": stroke,
          "stroke-dasharray": `${Math.max(dash - 2, 0)} ${gap + 2}`,
          "stroke-dashoffset": -cumulative * circumference,
          transform: `rotate(-90 ${cx} ${cy})`,
          "stroke-linecap": "butt"
        });
        svg.appendChild(circle);
        cumulative += frac;
      });
    }

    // center text
    const label = el("text", { x: cx, y: cy - 4, "text-anchor": "middle", "font-size": "24", "font-weight": "700", fill: "var(--text)" });
    label.textContent = ns.utils.fmtNumber(total);
    svg.appendChild(label);
    const sub = el("text", { x: cx, y: cy + 18, "text-anchor": "middle", "font-size": "11", fill: aspectTextColor() });
    sub.textContent = opts.centerLabel || "Total";
    svg.appendChild(sub);

    container.innerHTML = "";
    container.appendChild(svg);

    // legend
    let legend = container.parentNode.querySelector(".chart-legend");
    if (!legend) {
      legend = document.createElement("div");
      legend.className = "chart-legend";
      container.parentNode.appendChild(legend);
    }
    legend.innerHTML = items
      .map(
        (item, i) =>
          `<span class="li"><span class="dot" style="background:${item.color || C.PALETTE[i % C.PALETTE.length]}"></span>${ns.utils.escapeHtml(item.label)}<span class="amt">${ns.utils.fmtMoney(item.value)}</span></span>`
      )
      .join("");
  };

  /* ---------- auto-redraw on theme change & resize ---------- */
  C.observe = function (container, draw) {
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(
      ns.utils.debounce(() => {
        if (document.body.contains(container) && container.clientWidth > 30) draw();
      }, 120)
    );
    ro.observe(container);
  };
})(window.App);