// Dhvani Patel portfolio — Phase 2 reference build

// As the visitor starts scrolling, the hero video + subtitle fade
// out together (one wrapper, one opacity) — a soft dissolve into the film
// strip below, not a hard cut. Continuous function of scroll position.
function initHeroFade(){
  const content = document.querySelector('.hero-content');
  if(!content) return;
  const FADE_END = 350; // px of scroll for a full fade — kept short/subtle

  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  let ticking = false;
  function update(){
    const p = clamp01(window.scrollY / FADE_END);
    content.style.opacity = 1 - p;
    ticking = false;
  }
  function onScroll(){
    if(!ticking){ ticking = true; requestAnimationFrame(update); }
  }
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// Projects: a continuous rolling deck, not a scatter-to-grid animation.
// Motion idea only — six cards are imagined seated around one invisible
// cylinder; a single scroll-driven value W ("wheel position") advances
// through the deck, and every card's transform is a smooth function of
// its distance from the front seat (r = cardIndex − W). At r=0 a card is
// FRONT (largest, flat, on top); as W keeps advancing that same card's r
// goes negative — it keeps rotating/rising/shrinking away — while the
// next card's r approaches 0 and it becomes FRONT in its place. Because
// every card reads from the same continuous W, the whole deck reads as
// one connected roll, not N independent animations. Once the roll has
// cycled through all six cards, the tail of the scroll range blends the
// roll transform into the existing final grid layout.
function initProjectStage(){
  const stage = document.getElementById('project-stage');
  if(!stage) return;
  const cardsWrap = stage.querySelector('.stage-cards');
  const cards = Array.from(stage.querySelectorAll('.stage-card'));
  const cue = stage.querySelector('.stage-cue');
  const allProjects = stage.querySelector('.stage-all-projects');
  if(!cards.length) return;

  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    stage.classList.add('no-motion');
    return;
  }

  const N = cards.length;
  const ROLL_END = 0.72; // fraction of total scroll spent rolling; the rest resolves into the grid

  function clamp01(v){ return Math.max(0, Math.min(1, v)); }
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function easeInOutCubic(t){ return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }
  function lerp(a, b, t){ return a + (b - a) * t; }

  // Given a card's signed distance from the front seat, return its roll
  // pose as {xPct, yPct, rot, scale, z, opacity} — all continuous, smooth
  // functions of r, so the deck never jumps between discrete states.
  function poseAt(r){
    const rc = clamp(r, -3, 3);
    return {
      xPct: Math.sin(rc * 0.9) * 6,
      yPct: rc * 18,
      rot: rc * -24,
      scale: clamp(1.15 - Math.abs(rc) * 0.22, 0.5, 1.15),
      z: Math.round(100 - Math.abs(rc) * 12),
      opacity: clamp(1 - Math.max(0, Math.abs(rc) - 1.4) * 0.5, 0.2, 1),
    };
  }

  function responsiveConfig(){
    const w = window.innerWidth;
    if(w <= 809) return { mul: 0.6, columns: 2, gap: 12 };
    if(w <= 1199) return { mul: 0.8, columns: 2, gap: 16 };
    return { mul: 1, columns: 3, gap: 22 };
  }

  let cfg = responsiveConfig();
  let stageW = 0, stageH = 0;
  let finals = []; // grid slot per card, in px offset from stage center

  function layout(){
    cfg = responsiveConfig();
    const stageRect = cardsWrap.getBoundingClientRect();
    stageW = stageRect.width;
    stageH = stageRect.height;

    const cardRect = cards[0].getBoundingClientRect();
    const cardW = cardRect.width;
    const cardH = cardRect.height;
    const cols = cfg.columns;
    const rows = Math.ceil(N / cols);
    const gap = cfg.gap;
    const gridW = cols * cardW + (cols - 1) * gap;
    const gridH = rows * cardH + (rows - 1) * gap;
    const startX = -gridW / 2 + cardW / 2;
    const startY = -gridH / 2 + cardH / 2;

    finals = cards.map((_, i) => ({
      x: startX + (i % cols) * (cardW + gap),
      y: startY + Math.floor(i / cols) * (cardH + gap),
    }));
  }

  function update(){
    const stageRect = stage.getBoundingClientRect();
    const stageDocTop = stageRect.top + window.scrollY;
    const range = stage.offsetHeight - window.innerHeight;
    const overall = range > 0
      ? clamp01((window.scrollY - stageDocTop) / range)
      : (window.scrollY > stageDocTop ? 1 : 0);

    if(cue) cue.style.opacity = String(1 - clamp01(overall / 0.05));

    // W advances 0 → N-1 across the roll phase, then holds — the deck
    // doesn't keep spinning once it's handed off to the resolve phase.
    const rollP = clamp01(overall / ROLL_END);
    const W = easeInOutCubic(rollP) * (N - 1);

    // How far into the resolve phase (0 = still rolling, 1 = grid).
    const g = overall <= ROLL_END ? 0 : easeInOutCubic((overall - ROLL_END) / (1 - ROLL_END));

    // "All Projects" lives inside the pinned stage and only appears once
    // the grid has mostly locked into place — fades in over the back
    // third of the resolve phase, right alongside the settled cards.
    if(allProjects){
      const apOpacity = clamp01((g - 0.65) / 0.35);
      allProjects.style.opacity = String(apOpacity);
      allProjects.style.pointerEvents = apOpacity > 0.05 ? 'auto' : 'none';
    }

    cards.forEach((card, i) => {
      const r = i - W;
      const pose = poseAt(r);

      const rollX = (pose.xPct / 100) * stageW * cfg.mul;
      const rollY = (pose.yPct / 100) * stageH * cfg.mul;
      const rollRot = pose.rot * cfg.mul;
      const rollScale = 1 + (pose.scale - 1) * cfg.mul;

      const final = finals[i] || { x: 0, y: 0 };
      const x = lerp(rollX, final.x, g);
      const y = lerp(rollY, final.y, g);
      const rot = lerp(rollRot, 0, g);
      const scale = lerp(rollScale, 1, g);
      const opacity = lerp(pose.opacity, 1, g);

      card.style.zIndex = g < 0.5 ? pose.z : (i + 10);
      card.style.opacity = String(opacity);
      card.style.transform =
        `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`;
    });
  }

  let ticking = false;
  function onScroll(){
    if(!ticking){ ticking = true; requestAnimationFrame(() => { update(); ticking = false; }); }
  }

  let resizeTimer;
  function onResize(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { layout(); update(); }, 150);
  }

  layout();
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
}

// Set by initCharacterAnimation, used by initFlipCard's click handler so a
// click can stop/reset the character's idle animation before flipping.
let characterAnim = null;

// About/flip: the whole card toggles on click (or Enter/Space, since it's
// a div acting as a button), not just a small link — matches "click on
// the card to flip it". Before flipping, the hover tilt (see initFlipTilt)
// and the character idle animation (see initCharacterAnimation) are both
// reset to neutral so the flip always starts from a squared-on, resting pose.
function initFlipCard(){
  const card = document.querySelector('.flip-card');
  const tilt = document.querySelector('.flip-tilt');
  if(!card) return;
  function toggle(){
    if(tilt){
      tilt.classList.remove('is-hovering');
      tilt.style.transition = 'transform 0.5s cubic-bezier(.22,1,.36,1)';
      tilt.style.transform = 'rotateX(0deg) rotateY(0deg)';
    }
    if(characterAnim){
      characterAnim.stop();
      characterAnim.resetToFirst();
    }
    const flipped = card.classList.toggle('is-flipped');
    card.setAttribute('aria-expanded', String(flipped));
    // Only resume the idle animation once the card has settled back to the
    // front face — she isn't visible while the back face is showing.
    if(characterAnim && !flipped){
      setTimeout(() => characterAnim.start(), 900);
    }
  }
  card.addEventListener('click', toggle);
  card.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      toggle();
    }
  });
}

// Flip card hover tilt: a separate layer (.flip-tilt) wrapping .flip-card
// leans subtly toward the cursor, like a physical card being tipped to
// catch the light — independent of the click-driven 180° flip on the card
// itself (see initFlipCard). Mouse-only: skipped on touch/coarse-pointer
// devices (no hover state to track) and under prefers-reduced-motion.
function initFlipTilt(){
  const tilt = document.querySelector('.flip-tilt');
  if(!tilt) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const MAX_TILT = 8; // degrees — subtle, not a gimmick
  const INSTANT = 'none';
  const EASED = 'transform 0.5s cubic-bezier(.22,1,.36,1)';

  function onEnter(){
    tilt.classList.add('is-hovering');
    tilt.style.transition = INSTANT;
  }
  function onMove(e){
    const rect = tilt.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;  // 0 (left) .. 1 (right)
    const py = (e.clientY - rect.top) / rect.height;   // 0 (top) .. 1 (bottom)
    const rotateX = (0.5 - py) * (MAX_TILT * 2); // cursor above -> tilts up
    const rotateY = (px - 0.5) * (MAX_TILT * 2); // cursor right -> tilts right
    tilt.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }
  function onLeave(){
    tilt.classList.remove('is-hovering');
    tilt.style.transition = EASED;
    tilt.style.transform = 'rotateX(0deg) rotateY(0deg)';
  }

  tilt.addEventListener('mouseenter', onEnter);
  tilt.addEventListener('mousemove', onMove);
  tilt.addEventListener('mouseleave', onLeave);
}

// Flip-card character idle animation: cycles the pixel-art character
// through up to four expression frames (about-character-01..04.png) and
// gives her a barely-there left/center/right sway — an ambient detail,
// entirely independent of the cursor-driven card tilt above. Frame 1
// (the existing character) always exists; frames 2–4 are optional and
// picked up automatically the moment their files are added next to it —
// nothing here needs to change when they arrive. Runs on mobile too
// (it's time-based, not hover-based); pauses off-screen via
// IntersectionObserver, and stays off entirely under prefers-reduced-motion.
function initCharacterAnimation(){
  const wrap = document.querySelector('.flip-character');
  const scene = document.querySelector('.flip-scene');
  if(!wrap || !scene) return;
  const frameEls = Array.from(wrap.querySelectorAll('.flip-character-frame'));
  if(!frameEls.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Frame 1 ships with the site, so it's always available. Frames 2-4 are
  // added to `available` (in frame order) only once their image has
  // actually loaded — a missing file just never joins the rotation.
  const available = [];
  function addAvailable(el){
    if(available.includes(el)) return;
    available.push(el);
    available.sort((a, b) => Number(a.dataset.frame) - Number(b.dataset.frame));
  }
  frameEls.forEach((el) => {
    if(el.dataset.frame === '1' || (el.complete && el.naturalWidth > 0)){
      addAvailable(el);
    } else {
      el.addEventListener('load', () => addAvailable(el));
      el.addEventListener('error', () => { el.style.display = 'none'; });
    }
  });

  let index = 0;
  let timer = null;
  let running = false;

  // Visibility is opacity-only (0 <-> 1, no transition) — with exactly one
  // frame ever at opacity 1, stacking order is irrelevant, so this never
  // touches z-index. It used to bump z-index on every swap (a leftover
  // from an earlier crossfade version of this animation), but mutating
  // z-index on a descendant of .flip-card's backface-hidden/preserve-3d
  // stack forces WebKit to recompute that layer's stacking context on
  // every single frame change — which is what surfaced as a flash of the
  // patch background at the loop boundary. Dropping the z-index write
  // leaves the frame swap as a single, cheap opacity toggle with nothing
  // for the 3D-transformed ancestor to repaint around.
  function showActive(){
    const active = available[index] || frameEls[0];
    frameEls.forEach((el) => el.classList.toggle('is-active', el === active));
  }
  showActive();

  function scheduleNext(){
    // ~1–1.2s per frame, lightly randomized so the cycle reads as a living
    // gesture rather than a metronome.
    timer = setTimeout(() => {
      if(available.length > 1){
        index = (index + 1) % available.length;
        showActive();
      }
      scheduleNext();
    }, 1000 + Math.random() * 200);
  }

  function start(){
    if(running || reduceMotion) return;
    running = true;
    wrap.classList.add('is-idle');
    scheduleNext();
  }
  function stop(){
    running = false;
    wrap.classList.remove('is-idle');
    clearTimeout(timer);
  }
  function resetToFirst(){
    index = 0;
    showActive();
  }

  characterAnim = { start, stop, resetToFirst };

  if(reduceMotion) return; // frame 1 only, no cycling, no sway — set above

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if(entry.isIntersecting) start(); else stop();
    });
  }, { threshold: 0.15 });
  observer.observe(scene);
}

function initNavToggle(){
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if(!toggle || !links) return;
  toggle.addEventListener('click', () => {
    const open = links.style.display === 'flex';
    links.style.display = open ? 'none' : 'flex';
  });
}

// Contact form: only present on contact.html, and only wired up if the
// EmailJS SDK (loaded there, not here — no other page sends mail) is on the
// page. Two separate sends per submission rather than one linked-template
// send, so this doesn't depend on the "Linked Template" setting being
// configured correctly in the EmailJS dashboard: one call notifies Dhvani,
// the other auto-replies to the visitor, both from the same field values.
function initContactForm(){
  const form = document.querySelector('.contact-form');
  if(!form || typeof emailjs === 'undefined') return;

  const submitBtn = form.querySelector('.contact-submit');
  const status = form.querySelector('.form-status');
  const nameInput = form.querySelector('#name');
  const emailInput = form.querySelector('#email');
  const typeInput = form.querySelector('#type');
  const briefInput = form.querySelector('#brief');
  const submitLabel = submitBtn.textContent;

  const SERVICE_ID = 'service_nv45ypg';
  const NOTIFY_TEMPLATE_ID = 'template_glf5vp8';
  const AUTOREPLY_TEMPLATE_ID = 'template_tqib8kv';

  function setStatus(message, isError){
    status.textContent = message;
    status.classList.toggle('is-error', !!isError);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if(submitBtn.disabled) return; // guards against double-clicks/double-submits mid-send

    // Field names on the existing inputs are id="name"/"email"/"type"/"brief"
    // (no name= attributes) — mapped here to the EmailJS templates' exact
    // {{name}}/{{email}}/{{project_type}}/{{message}} variables rather than
    // renaming the HTML to match.
    const emailValue = emailInput.value.trim();
    const params = {
      name: nameInput.value.trim(),
      email: emailValue,
      project_type: typeInput.value,
      message: briefInput.value.trim(),
      reply_to: emailValue, // so "Reply-To" on the notification template can reference {{reply_to}}
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    setStatus('', false);

    Promise.all([
      emailjs.send(SERVICE_ID, NOTIFY_TEMPLATE_ID, params),
      emailjs.send(SERVICE_ID, AUTOREPLY_TEMPLATE_ID, params)
    ]).then(() => {
      submitBtn.textContent = 'Sent ✓';
      setStatus("Thanks — I've got your message and will get back to you soon.", false);
      form.reset();
    }).catch((err) => {
      console.error('Contact form send failed:', err);
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel;
      setStatus("Something went wrong sending that — mind trying again?", true);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initHeroFade();
  initProjectStage();
  initFlipCard();
  initFlipTilt();
  initCharacterAnimation();
  initNavToggle();
  initContactForm();
});
