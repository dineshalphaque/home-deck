// Text that is too long for its box scrolls like a car stereo: it holds at the start, slides slowly to the end,
// holds, and starts over. Short text stays still. Only a transform moves (a Web Animation the compositor runs), so
// a TV's graphics chip just slides it. Lite mode and reduced motion get a plain ellipsis instead.
window.Marquee = (() => {
  const SPEED = 35;                    // stage pixels a second: an easy reading pace
  const HOLD = 2000;                   // milliseconds at each end
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const boxes = new Set();

  // wraps a box's content in the moving line (once); an id on the box moves to the line, so code that sets the
  // box's text by id keeps working
  function setup(box) {
    if (!box.querySelector(':scope > .mq')) {
      const line = document.createElement('span');
      line.className = 'mq';
      while (box.firstChild) line.appendChild(box.firstChild);
      if (box.id) { line.id = box.id; box.removeAttribute('id'); }
      box.appendChild(line);
      box.classList.add('mq-box');
    }
    boxes.add(box);
  }

  // measures again and starts from the beginning (call when the text changes)
  function update(box) {
    const line = box.querySelector(':scope > .mq');
    if (!line) return;
    line.getAnimations().forEach(a => a.cancel());
    box.classList.remove('is-mq');
    const still = reduce.matches || document.documentElement.classList.contains('lite');
    const over = box.scrollWidth - box.clientWidth;          // the box clips, so its scroll width is the whole line
    if (still || over <= 2) return;
    box.classList.add('is-mq');
    const dist = over + 20;                                   // past the soft edge, so the last letters read clearly
    const move = (dist / SPEED) * 1000, total = move + HOLD * 2, a = HOLD / total, b = 1 - a;
    const end = `translateX(${-dist}px)`;
    line.animate([{ transform: 'none', offset: 0 }, { transform: 'none', offset: a }, { transform: end, offset: b },
      { transform: end, offset: 1 }], { duration: total, iterations: Infinity });
  }

  // Lite mode switching on or off changes whether anything scrolls
  new MutationObserver(() => boxes.forEach(update))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  return { setup, update };
})();
