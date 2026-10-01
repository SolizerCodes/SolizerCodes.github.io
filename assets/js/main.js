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

  /* Own scroll animation (browser smooth-scroll drops or ignores targets when clicked repeatedly).
     While it runs, `current` lags behind, so rapid clicks build on `target`. */
  var target = 0, raf = null;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function base() { return raf ? target : current; }

  function stopAnim() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    track.classList.remove("animating");
  }

  function goTo(i, instant) {
    i = Math.max(0, Math.min(tiles.length - 1, i));   /* clamped: no wrap-around */
    target = i;
    var t = tiles[i];
    var to = t.offsetLeft + t.offsetWidth / 2 - track.clientWidth / 2;
    stopAnim();
    if (instant || reduceMotion.matches) { track.scrollLeft = to; return; }
    var from = track.scrollLeft, start = performance.now(), dur = 380;
    track.classList.add("animating");   /* switches scroll-snap off while we drive the scroll */
    raf = requestAnimationFrame(function step(now) {
      var p = Math.min(1, (now - start) / dur);
      track.scrollLeft = from + (to - from) * (1 - Math.pow(1 - p, 3));   /* ease-out */
      if (p < 1) { raf = requestAnimationFrame(step); } else { stopAnim(); }
    });
  }
  /* The user grabs the carousel: stop animating and let the browser take over. */
  ["touchstart", "wheel", "pointerdown"].forEach(function (ev) {
    track.addEventListener(ev, stopAnim, { passive: true });
  });

  function update() {
    var mid = track.scrollLeft + track.clientWidth / 2, best = 0, bestDist = Infinity;
    tiles.forEach(function (t, i) {
      var dist = t.offsetLeft + t.offsetWidth / 2 - mid;
      var d = Math.abs(dist);
      if (d < bestDist) { bestDist = d; best = i; }

      /* Depth effect: the further from the centre, the smaller, fainter and blurrier. */
      var a = Math.min(d / (t.offsetWidth * 0.65), 2);
      t.style.transform = "scale(" + (1 - 0.1 * a).toFixed(3) + ")";
      /* No opacity here: a see-through tile shows the tile behind it as a pale ghost. Dim instead. */
      t.style.filter = a < 0.05 ? "none" : "blur(" + (a * 2).toFixed(2) + "px) brightness(" + (1 - 0.1 * a).toFixed(3) + ")";
      t.style.zIndex = String(100 - Math.round(a * 20));

      /* Flip back as soon as the tile is scrolled away from. */
      if (a > 0.25 && t.classList.contains("flipped")) setFlipped(t, false);
    });
    current = best;
    tiles.forEach(function (t, i) { t.tabIndex = i === current ? 0 : -1; });
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
  window.addEventListener("resize", function () { goTo(current, true); update(); });

  prev.addEventListener("click", function () { goTo(base() - 1); });
  next.addEventListener("click", function () { goTo(base() + 1); });

  document.addEventListener("keydown", function (e) {
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(base() - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); goTo(base() + 1); }
  });

  /* ---------- Flip ---------- */
  /* Enter / Space always flips the centred tile, wherever keyboard focus happens to be. */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var t = e.target;
    var onTile = t.classList && t.classList.contains("tile");
    if (t !== document.body && !onTile) return;   /* buttons, links etc. keep their own behaviour */
    e.preventDefault();
    flipCurrent();
  });

  function setFlipped(tile, on) {
    tile.classList.toggle("flipped", on);
    tile.setAttribute("aria-pressed", String(on));
    tile.querySelector(".front").setAttribute("aria-hidden", String(on));
    tile.querySelector(".back").setAttribute("aria-hidden", String(!on));
  }
  function flipCurrent() {
    var tile = tiles[current];
    var on = !tile.classList.contains("flipped");
    tiles.forEach(function (t) { if (t !== tile) setFlipped(t, false); });
    setFlipped(tile, on);
  }
  tiles.forEach(function (tile, i) {
    setFlipped(tile, false);
    function toggle() {
      if (i !== current) { goTo(i); return; }   /* side tile: bring to front first */
      flipCurrent();
    }
    var downX = 0, downY = 0;
    tile.addEventListener("pointerdown", function (e) { downX = e.clientX; downY = e.clientY; });
    tile.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;   /* links on the back keep working */
      /* Selecting text (mouse dragged, or text now selected) must not count as a flip click. */
      if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) return;
      var sel = window.getSelection();
      if (sel && !sel.isCollapsed && tile.contains(sel.anchorNode)) return;
      toggle();
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
