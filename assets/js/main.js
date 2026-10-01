(function () {
  /* ---------- Theme: Auto (system) / Light / Dark ---------- */
  var root = document.documentElement;
  var themeButtons = document.querySelectorAll("[data-theme-choice]");

  function currentChoice() {
    var t = root.dataset.theme;
    return t === "light" || t === "dark" ? t : "auto";
  }
  function paintThemeButtons() {
    var c = currentChoice();
    themeButtons.forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.themeChoice === c));
    });
  }
  themeButtons.forEach(function (b) {
    b.addEventListener("click", function () {
      var c = b.dataset.themeChoice;
      try {
        if (c === "auto") { localStorage.removeItem("theme"); }
        else { localStorage.setItem("theme", c); }
      } catch (e) {}
      if (c === "auto") { delete root.dataset.theme; } else { root.dataset.theme = c; }
      paintThemeButtons();
    });
  });
  paintThemeButtons();

  /* ---------- Carousel ---------- */
  var track = document.getElementById("track");
  if (!track) return;
  var tiles = Array.prototype.slice.call(track.querySelectorAll(".tile"));
  var prev = document.querySelector(".nav.prev");
  var next = document.querySelector(".nav.next");
  var dotsEl = document.getElementById("dots");
  var countEl = document.getElementById("count");
  var current = 0;

  var dots = tiles.map(function (_, i) {
    var d = document.createElement("button");
    d.type = "button"; d.className = "dot";
    d.setAttribute("aria-label", "Go to tile " + (i + 1));
    d.addEventListener("click", function () { goTo(i); });
    dotsEl.appendChild(d);
    return d;
  });

  function goTo(i) {
    i = Math.max(0, Math.min(tiles.length - 1, i));   /* clamped: no wrap-around */
    var t = tiles[i];
    track.scrollTo({ left: t.offsetLeft + t.offsetWidth / 2 - track.clientWidth / 2 });
  }

  function update() {
    var mid = track.scrollLeft + track.clientWidth / 2, best = 0, bestDist = Infinity;
    tiles.forEach(function (t, i) {
      var dist = t.offsetLeft + t.offsetWidth / 2 - mid;
      var d = Math.abs(dist);
      if (d < bestDist) { bestDist = d; best = i; }

      /* Depth effect: the further from the centre, the smaller, fainter and blurrier. */
      var a = Math.min(d / (t.offsetWidth * 0.65), 2);
      t.style.transform = "scale(" + (1 - 0.1 * a).toFixed(3) + ")";
      t.style.filter = a < 0.05 ? "none" : "blur(" + (a * 2).toFixed(2) + "px)";
      t.style.opacity = (1 - 0.15 * a).toFixed(3);
      t.style.zIndex = String(100 - Math.round(a * 20));

      /* Flip back as soon as the tile is scrolled away from. */
      if (a > 0.25 && t.classList.contains("flipped")) setFlipped(t, false);
    });
    current = best;
    prev.disabled = current === 0;
    next.disabled = current === tiles.length - 1;
    countEl.textContent = (current + 1) + " / " + tiles.length;
    dots.forEach(function (d, i) {
      if (i === current) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
    });
  }

  var ticking = false;
  track.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; update(); });
  }, { passive: true });
  window.addEventListener("resize", function () { goTo(current); update(); });

  prev.addEventListener("click", function () { goTo(current - 1); });
  next.addEventListener("click", function () { goTo(current + 1); });

  document.addEventListener("keydown", function (e) {
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(current - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); goTo(current + 1); }
  });

  /* ---------- Flip ---------- */
  function setFlipped(tile, on) {
    tile.classList.toggle("flipped", on);
    tile.setAttribute("aria-pressed", String(on));
    tile.querySelector(".front").setAttribute("aria-hidden", String(on));
    tile.querySelector(".back").setAttribute("aria-hidden", String(!on));
  }
  tiles.forEach(function (tile, i) {
    setFlipped(tile, false);
    function toggle() {
      if (i !== current) { goTo(i); return; }   /* side tile: bring to front first */
      var on = !tile.classList.contains("flipped");
      tiles.forEach(function (t) { if (t !== tile) setFlipped(t, false); });
      setFlipped(tile, on);
    }
    tile.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;   /* links on the back keep working */
      toggle();
    });
    tile.addEventListener("keydown", function (e) {
      if (e.target !== tile) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  });

  /* ---------- "More text below" hint on the back ---------- */
  function updateMore(inner) {
    var more = inner.scrollHeight > inner.clientHeight + 2 &&
               inner.scrollTop + inner.clientHeight < inner.scrollHeight - 2;
    inner.parentNode.classList.toggle("more", more);
  }
  var inners = tiles.map(function (t) { return t.querySelector(".back-inner"); });
  function updateAllMore() { inners.forEach(updateMore); }
  inners.forEach(function (el) {
    el.addEventListener("scroll", function () { updateMore(el); }, { passive: true });
  });
  window.addEventListener("resize", updateAllMore);
  window.addEventListener("load", updateAllMore);

  update();
  updateAllMore();
})();
