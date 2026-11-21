(async () => {
  const NS = 'http://www.w3.org/2000/svg';
  const root = document.querySelector('.race-demo');
  if (!root) return;
  const response = await fetch('assets/race-preview.json').catch(() => null);
  if (!response?.ok) return;
  const data = await response.json();
  const SPEED = 6;
  const svg = (tag, attrs, parent) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    parent?.appendChild(node);
    return node;
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const q = selector => root.querySelector(selector);
  const lapTime = ms => {
    const m = Math.floor(ms / 60000);
    const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
    return `${m}:${s}`;
  };
  const raceTime = (ms, digits) => {
    const total = ms / 1000;
    const m = Math.floor(total / 60);
    return `${m}:${(total - m * 60).toFixed(digits).padStart(digits + 3, '0')}`;
  };
  const gap = ms => `+${(ms / 1000).toFixed(3)} s`;
  const points = list => list.map(p => `${p[0]},${p[1]}`).join(' ');

  const [w, h] = data.size;
  const map = q('.rd-map');
  const drawing = svg('svg', { viewBox: `0 -24 ${w} ${h + 48}`, role: 'img', 'aria-label': `Map of ${data.track}` });
  svg('polyline', { points: points(data.line), class: 'rd-track' }, drawing);
  const bestLine = svg('polyline', { points: points(data.line), class: 'rd-best', visibility: 'hidden' }, drawing);
  const lostGroup = svg('g', { visibility: 'hidden' }, drawing);
  for (const place of data.compare.lost) svg('polyline', { points: points(data.compare.line.slice(place.from, place.to + 1)), class: 'rd-lost' }, lostGroup);
  const [s0, s1] = [data.line[0], data.line[2]];
  const length = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
  const [nx, ny] = [-(s1[1] - s0[1]) / length, (s1[0] - s0[0]) / length];
  svg('line', { x1: s0[0] + nx * 9, y1: s0[1] + ny * 9, x2: s0[0] - nx * 9, y2: s0[1] - ny * 9, class: 'rd-start' }, drawing);
  const trail = svg('polyline', { points: '', class: 'rd-trail' }, drawing);
  const offGroup = svg('g', {}, drawing);
  const offMarks = data.off.map(off => svg('circle', { cx: off.at[0], cy: off.at[1], r: 5, class: 'rd-off', visibility: 'hidden' }, offGroup));
  const labels = svg('g', { visibility: 'hidden' }, drawing);
  for (const place of data.compare.lost) {
    const k = Math.floor((place.from + place.to) / 2);
    const mid = data.compare.line[k];
    const next = data.compare.line[Math.min(k + 1, data.compare.line.length - 1)];
    const flat = Math.abs(next[0] - mid[0]) > Math.abs(next[1] - mid[1]);
    const right = mid[0] < w / 2;
    const down = mid[1] > h / 2;
    const [cx, cy] = flat ? [mid[0], mid[1] + (down ? 30 : -30)] : [mid[0] + (right ? 57 : -57), mid[1]];
    svg('line', { x1: mid[0], y1: mid[1], x2: flat ? cx : cx + (right ? -27 : 27), y2: flat ? cy + (down ? -11 : 11) : cy, class: 'rd-leader' }, labels);
    svg('rect', { x: cx - 27, y: cy - 11, width: 54, height: 22, class: 'rd-tag' }, labels);
    const text = svg('text', { x: cx, y: cy + 4.5, class: 'rd-tag-text' }, labels);
    text.textContent = `+${(place.ms / 1000).toFixed(2)} s`;
  }
  const car = svg('circle', { r: 8, class: 'rd-car', visibility: 'hidden' }, drawing);
  map.appendChild(drawing);
  const big = el('button', 'rd-big');
  big.type = 'button';
  big.innerHTML = '<span aria-hidden="true"></span>Play';
  big.setAttribute('aria-label', 'Play the race');
  map.appendChild(big);
  const toggle = q('.rd-toggle');
  const label = q('.rd-label');
  const setToggle = (text, running) => {
    label.textContent = text;
    toggle.classList.toggle('running', running);
  };
  const caption = el('p', 'rd-caption');
  map.appendChild(caption);

  const status = q('.rd-status');
  const word = q('.rd-word');
  const stats = q('.rd-stats');
  const dots = q('.rd-dots');
  const bar = q('.rd-bar');
  const time = q('.rd-time');
  const body = q('.rd-laps tbody');
  const table = q('.rd-laps');
  const empty = q('.rd-empty');
  const live = q('.rd-live');
  const total = data.laps.length;
  const inRace = data.lapsInRace;
  const hasOff = data.off.length > 0;
  if (!hasOff) q('.rd-laps thead th:last-child').remove();
  const lineMs = data.line.at(-1)[2];
  const ends = data.laps.reduce((acc, lap) => [...acc, (acc.at(-1) ?? 0) + lap.ms], []);

  const setStatus = (kind, text) => {
    status.className = `rd-status ${kind}`;
    status.lastElementChild.textContent = text;
  };
  const setWord = (main, of) => {
    word.firstElementChild.textContent = main;
    word.lastElementChild.textContent = of;
  };
  const setStats = list => {
    stats.replaceChildren(
      ...list.map(([value, caption, yellow]) => {
        const item = el('div', 'rd-stat');
        item.append(el('b', yellow ? 'y' : '', value), el('span', '', caption));
        return item;
      })
    );
  };
  const setDots = (done, now, best) => {
    dots.replaceChildren();
    for (let n = 1; n <= inRace; n++) {
      dots.append(el('span', `rd-ld${n <= done ? ' done' : ''}${n === now ? ' now' : ''}${n === best ? ' best' : ''}`));
      if (data.laps.find(lap => lap.n === n)?.pitIn) dots.append(el('span', 'rd-pitmark'));
    }
    dots.setAttribute('aria-label', `Laps: ${done} of ${inRace} done`);
  };
  const bestOf = laps => laps.reduce((best, lap) => (best === null || lap.ms < best.ms ? lap : best), null);
  const renderTable = (count, fresh) => {
    const laps = data.laps.slice(0, count);
    const best = bestOf(laps);
    body.replaceChildren();
    for (const lap of laps) {
      const row = el('tr', lap === best ? 'is-best' : lap.n === fresh ? 'is-new' : '');
      const timeCell = el('td');
      timeCell.append(el('b', 'rd-t', lapTime(lap.ms)));
      if (lap === best) timeCell.append(el('span', 'rd-tag-best', 'best'));
      else if (lap.pitIn) timeCell.append(el('span', 'rd-note', 'into the pit lane'));
      else if (lap.pitOut) timeCell.append(el('span', 'rd-note', 'out of the pit lane'));
      const off = data.off.filter(item => item.lap === lap.n).length;
      const offCell = el('td', 'rd-num');
      if (off > 0) offCell.append(el('span', 'rd-ring'), document.createTextNode(String(off)));
      row.append(el('td', 'rd-n', String(lap.n)), timeCell, el('td', 'rd-num rd-gap', lap === best ? '' : gap(lap.ms - best.ms)), el('td', 'rd-num', `${lap.from} → ${lap.to}`), el('td', 'rd-num rd-top', `${lap.topKmh} km/h`));
      if (hasOff) row.append(offCell);
      body.append(row);
      const pit = data.pits.find(item => item.afterLap === lap.n);
      if (pit) {
        const pitRow = el('tr', 'rd-pit');
        const cell = el('td');
        cell.colSpan = hasOff ? 6 : 5;
        cell.append(el('b', '', 'PIT STOP'), document.createTextNode(` ${(pit.ms / 1000).toFixed(2)} s in the pit lane · Fuel ${pit.fuelBefore} → ${pit.fuelAfter}`));
        pitRow.append(cell);
        body.append(pitRow);
      }
    }
    table.hidden = count === 0;
    empty.hidden = count > 0;
  };
  const positionAt = ms => {
    let position = data.startPosition;
    for (const [at, value] of data.positions) if (at <= ms) position = value;
    return position;
  };
  const pointAt = share => {
    const t = share * lineMs;
    const i = data.line.findIndex(p => p[2] >= t);
    if (i <= 0) return [i === 0 ? 0 : data.line.length - 1, ...(i === 0 ? data.line[0] : data.line.at(-1))];
    const [a, b] = [data.line[i - 1], data.line[i]];
    const f = (t - a[2]) / (b[2] - a[2]);
    return [i, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };

  const before = () => {
    setStatus('', 'Race recording');
    setWord(`${total} LAPS`, `of ${inRace}`);
    setStats([[String(data.cars), 'cars'], [`P ${data.startPosition}`, 'start'], [`${data.lapLengthM.toLocaleString('en-GB')} m`, 'lap length']]);
    setDots(0, 0, 0);
    renderTable(0);
    trail.setAttribute('points', '');
    for (const mark of offMarks) mark.setAttribute('visibility', 'hidden');
    for (const node of [car, bestLine, lostGroup, labels]) node.setAttribute('visibility', 'hidden');
    map.classList.remove('compare');
    caption.textContent = '';
    big.hidden = false;
    setToggle('Play', false);
    bar.firstElementChild.style.width = '0';
    time.textContent = `The first ${total} laps in ${Math.round(data.shownMs / SPEED / 1000)} s: they play ${SPEED} times faster.`;
  };
  const finish = () => {
    const best = bestOf(data.laps);
    const position = data.laps.at(-1).to;
    setStatus('done', 'Recorded');
    setWord(`P ${position}`, `of ${data.cars}`);
    setStats([[lapTime(best.ms), `best lap · lap ${best.n}`, true], [`${data.startPosition} → ${position}`, `position, start to lap ${total}`]]);
    setDots(total, 0, best.n);
    renderTable(total);
    trail.setAttribute('points', '');
    for (const mark of offMarks) mark.setAttribute('visibility', 'hidden');
    car.setAttribute('visibility', 'hidden');
    for (const node of [bestLine, lostGroup, labels]) node.setAttribute('visibility', 'visible');
    map.classList.add('compare');
    const other = data.laps.find(lap => lap.n === data.compare.lap);
    caption.innerHTML = '';
    caption.append(el('b', '', `Lap ${other.n} is ${((other.ms - best.ms) / 1000).toFixed(3)} s slower than lap ${best.n}.`), el('br'), el('span', 'rd-key rd-key-best'), document.createTextNode(`lap ${best.n}, best `), el('span', 'rd-key rd-key-lost'), document.createTextNode(`where lap ${other.n} lost the most`));
    big.hidden = true;
    setToggle('Play', false);
    bar.firstElementChild.style.width = '0';
    time.textContent = `Lap ${other.n} against the best lap ${best.n}, as on the Compare tab. The race goes on for ${inRace - total} more laps.`;
    live.textContent = `Position ${position} of ${data.cars} after lap ${total}. Best lap ${lapTime(best.ms)}.`;
  };

  let frame = null;
  let started = 0;
  let shownLap = 0;
  const tick = now => {
    const ms = (now - started) * SPEED;
    if (ms >= data.shownMs) {
      frame = null;
      finish();
      return;
    }
    const index = ends.findIndex(end => end > ms);
    const lap = data.laps[index];
    const lapMs = ms - (ends[index - 1] ?? 0);
    const share = lapMs / lap.ms;
    const done = data.laps.slice(0, index);
    const best = bestOf(done);
    if (lap.n !== shownLap) {
      shownLap = lap.n;
      renderTable(index, index);
      setDots(index, lap.n, best?.n ?? 0);
      live.textContent = `Lap ${lap.n} of ${inRace}.`;
    }
    setWord(`LAP ${lap.n}`, `of ${inRace}`);
    const last = done.at(-1);
    setStats([[raceTime(lapMs, 1), 'this lap'], [`P ${positionAt(ms)}`, `of ${data.cars}`], [last ? lapTime(last.ms) : '–', 'last lap'], [best ? lapTime(best.ms) : '–', best ? `best lap · lap ${best.n}` : 'best lap', true]]);
    const [i, x, y] = pointAt(share);
    trail.setAttribute('points', `${points(data.line.slice(0, i))} ${x},${y}`);
    car.setAttribute('cx', x);
    car.setAttribute('cy', y);
    car.setAttribute('visibility', 'visible');
    data.off.forEach((off, k) => offMarks[k].setAttribute('visibility', off.lap < lap.n || (off.lap === lap.n && off.share <= share) ? 'visible' : 'hidden'));
    bar.firstElementChild.style.width = `${(ms / data.shownMs) * 100}%`;
    time.innerHTML = '';
    time.append(el('b', '', raceTime(ms, 1)), document.createTextNode(` of ${raceTime(data.shownMs, 1)} · ${SPEED}× faster`));
    frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    before();
  };
  const start = () => {
    stop();
    setStatus('rec', 'Recording');
    big.hidden = true;
    setToggle('Stop', true);
    shownLap = 0;
    started = performance.now();
    frame = requestAnimationFrame(tick);
  };
  toggle.addEventListener('click', () => (frame !== null ? stop() : start()));
  big.addEventListener('click', start);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame !== null) stop();
  });
  before();
  root.hidden = false;
})();
