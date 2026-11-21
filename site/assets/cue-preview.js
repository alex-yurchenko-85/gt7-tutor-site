(async () => {
  const NS = 'http://www.w3.org/2000/svg';
  const map = document.querySelector('.cue-map');
  const panel = document.querySelector('.cue-play');
  if (!map || !panel) return;
  const response = await fetch('assets/cue-preview.json').catch(() => null);
  if (!response?.ok || typeof AudioContext === 'undefined') return;
  const data = await response.json();
  const svg = (tag, attrs, parent) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    parent?.appendChild(node);
    return node;
  };
  const [w, h] = data.size;
  const root = svg('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': `Reference line of Interlagos sector 2, ${data.lengthM} m, with six cues` });
  const points = list => list.map(p => p.join(',')).join(' ');
  svg('polyline', { points: points(data.band), class: 'cm-turn' }, root);
  svg('polyline', { points: points(data.line), class: 'cm-line' }, root);
  const t1 = svg('text', { x: data.apex[0] + 30, y: data.apex[1] - 18, class: 'cm-t1' }, root);
  t1.textContent = 'T1';
  const unit = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    return [dx / l, dy / l];
  };
  const [s0, s1] = [data.line[0], data.line[2]];
  const [ux, uy] = unit(s0, s1);
  const [nx, ny] = [-uy, ux];
  svg('line', { x1: s0[0] + nx * 10, y1: s0[1] + ny * 10, x2: s0[0] - nx * 10, y2: s0[1] - ny * 10, class: 'cm-start' }, root);
  const ax = s0[0] + nx * 22, ay = s0[1] + ny * 22, tx = ax + ux * 24, ty = ay + uy * 24;
  svg('path', { d: `M${ax} ${ay}L${tx} ${ty}M${tx - ux * 8 + nx * 5} ${ty - uy * 8 + ny * 5}L${tx} ${ty}L${tx - ux * 8 - nx * 5} ${ty - uy * 8 - ny * 5}`, class: 'cm-arrow' }, root);
  const startText = svg('text', { x: s0[0] - ux * 18, y: s0[1] - uy * 18 + 4, class: 'cm-end' }, root);
  startText.textContent = 'start';
  const e1 = data.line.at(-1), [vx, vy] = unit(data.line.at(-3), e1);
  const flag = svg('g', { transform: `translate(${e1[0]} ${e1[1]}) rotate(${(Math.atan2(vy, vx) * 180) / Math.PI + 90})` }, root);
  svg('rect', { x: -10, y: -3.5, width: 20, height: 7, class: 'cm-flag' }, flag);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) svg('rect', { x: -10 + i * 4, y: -3.5 + j * 3.5, width: 4, height: 3.5, class: 'cm-check' }, flag);
  const finishText = svg('text', { x: e1[0] + vx * 22, y: e1[1] + vy * 22 + 4, class: 'cm-end' }, root);
  finishText.textContent = 'finish';
  const offsets = { 1: [18, 0], 2: [18, 6], 3: [2, -22], 4: [-20, -6], 5: [20, -8], 6: [-20, -16] };
  const marks = new Map();
  for (const mark of data.marks) {
    const [dx, dy] = offsets[mark.n] ?? [16, 0];
    const [x, y] = mark.at;
    const g = svg('g', { class: `cm-mark${mark.spoken ? '' : ' ns'}` }, root);
    svg('line', { x1: x, y1: y, x2: x + dx, y2: y + dy, class: 'cm-leader' }, g);
    svg('circle', { cx: x + dx, cy: y + dy, r: 11 }, g);
    const label = svg('text', { x: x + dx, y: y + dy + 4.5 }, g);
    label.textContent = String(mark.n);
    if (!mark.spoken) {
      svg('circle', { cx: x + dx + 10, cy: y + dy - 10, r: 7, class: 'cm-badge' }, g);
      for (const k of [-2.6, 0, 2.6]) svg('circle', { cx: x + dx + 10 + k, cy: y + dy - 10, r: 1.3, class: 'cm-pip' }, g);
    }
    marks.set(mark.n, g);
  }
  const car = svg('circle', { r: 9, class: 'cm-car', visibility: 'hidden' }, root);
  map.appendChild(root);
  const big = document.createElement('button');
  big.type = 'button';
  big.className = 'cm-big';
  big.innerHTML = '<span aria-hidden="true"></span>Play';
  big.setAttribute('aria-label', 'Play the cues of this reference, with sound');
  map.appendChild(big);
  map.hidden = false;
  panel.hidden = false;
  for (const mark of data.marks) if (!mark.spoken) document.querySelector(`.strip li[data-n="${mark.n}"]`)?.classList.add('ns');

  const toggle = panel.querySelector('.cue-toggle');
  const label = panel.querySelector('.cue-label');
  const bar = panel.querySelector('.cue-bar i');
  const time = panel.querySelector('.cue-time');
  const says = panel.querySelector('.cue-says');
  const phrase = { 'big-stop': 'Big brake ahead', 'hard-brake': 'Hard brake', 'speed-115': 'One fifteen', 'full-throttle': 'Full throttle', 'ease-off': 'Lift off' };
  let audio = null;
  const buffers = new Map();
  const load = async () => {
    audio ??= new AudioContext();
    await audio.resume();
    const keys = [...new Set(data.cues.flatMap(cue => cue.clips))];
    await Promise.all(keys.filter(key => !buffers.has(key)).map(async key => buffers.set(key, await audio.decodeAudioData(await (await fetch(`assets/voice/${key}.m4a`)).arrayBuffer()))));
  };
  let playing = [];
  const silence = () => {
    for (const source of playing) source.stop();
    playing = [];
  };
  const play = clips => {
    silence();
    let at = audio.currentTime;
    for (const key of clips) {
      const source = audio.createBufferSource();
      source.buffer = buffers.get(key);
      source.connect(audio.destination);
      source.start(at);
      at += source.buffer.duration;
      playing.push(source);
    }
  };
  const seconds = ms => `0:${(ms / 1000).toFixed(1).padStart(4, '0')}`;
  const position = ms => {
    const times = data.gridTimeMs;
    let i = times.findIndex(t => t > ms);
    if (i <= 0) return i === 0 ? data.line[0] : data.line.at(-1);
    const share = (ms - times[i - 1]) / (times[i] - times[i - 1]);
    const [a, b] = [data.line[i - 1], data.line[i]];
    return [a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share];
  };
  let timer = null;
  let current = null;
  let starting = false;
  const highlight = n => {
    for (const [key, g] of marks) g.classList.toggle('on', key === n);
    for (const li of document.querySelectorAll('.strip li[data-n]')) li.classList.toggle('on', Number(li.dataset.n) === n);
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
    silence();
    car.setAttribute('visibility', 'hidden');
    highlight(null);
    big.hidden = false;
    label.textContent = 'Play';
    toggle.classList.remove('running');
    bar.style.width = '0';
    time.textContent = '';
    says.textContent = '';
  };
  const start = async () => {
    if (starting) return;
    starting = true;
    try {
      await load();
    } catch {
      starting = false;
      says.textContent = 'The voice did not load in this browser.';
      return;
    }
    starting = false;
    stop();
    big.hidden = true;
    label.textContent = 'Stop';
    toggle.classList.add('running');
    const t0 = performance.now();
    let last = -1;
    timer = setInterval(() => {
      const ms = performance.now() - t0;
      for (const cue of data.cues) {
        if (cue.atMs > last && cue.atMs <= ms) {
          play(cue.clips);
          current = cue;
          highlight(cue.n);
          says.innerHTML = `The voice says: <b>${cue.clips.map(key => phrase[key]).join('. ')}</b>`;
        }
      }
      last = ms;
      if (current && ms - current.atMs > 1500) {
        highlight(null);
        current = null;
      }
      const [x, y] = position(ms);
      car.setAttribute('cx', x);
      car.setAttribute('cy', y);
      car.setAttribute('visibility', 'visible');
      bar.style.width = `${Math.min(100, (ms / data.timeMs) * 100)}%`;
      time.innerHTML = `<b>${seconds(Math.min(ms, data.timeMs))}</b> of ${seconds(data.timeMs)}, measured`;
      if (ms >= data.timeMs + 800) stop();
    }, 40);
  };
  toggle.addEventListener('click', () => (timer ? stop() : start()));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && timer) stop();
  });
  big.addEventListener('click', () => start());
})();
