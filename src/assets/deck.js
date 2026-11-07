// Makes the quote of the day flip as you scroll: quote on the front,
// who said it on the back.
const SCROLL_LENGTH = 1.2; // in screen heights

const section = document.getElementById("deck");

if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const card = section.querySelector(".biz-card");

  const face = (className, content) => {
    const el = document.createElement("div");
    el.className = `biz-face ${className}`;
    el.append(content);
    return el;
  };
  const front = face("biz-front", card.querySelector(".biz-quote"));
  const back = face("biz-back", card.querySelector(".biz-who"));
  const flip = document.createElement("div");
  flip.className = "biz-flip";
  flip.append(front, back);
  const hint = document.createElement("p");
  hint.className = "deck-hint";
  hint.textContent = "Scroll";
  const stage = document.createElement("div");
  stage.className = "deck-stage";
  stage.append(flip, hint);
  section.replaceChildren(stage);
  section.style.height = `${(SCROLL_LENGTH + 1) * 100}svh`;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  // Rest on each side for a moment, then turn.
  const ease = (f) => {
    const t = clamp((f - 0.15) / 0.7, 0, 1);
    return t * t * (3 - 2 * t);
  };

  function render(progress) {
    const turn = ease(progress);
    flip.style.transform = `rotateY(${turn * 180}deg)`;
    front.inert = turn > 0.5;
    back.inert = turn <= 0.5;
    hint.style.opacity = 1 - clamp(progress * 6, 0, 1);
  }

  const target = () => {
    const rect = section.getBoundingClientRect();
    return clamp(-rect.top / (rect.height - innerHeight), 0, 1);
  };

  // Follows the scroll position with a little lag so the turn feels weighted.
  let progress = target();
  let frame = 0;
  function tick() {
    const goal = target();
    progress += (goal - progress) * 0.14;
    if (Math.abs(goal - progress) < 0.001) progress = goal;
    render(progress);
    frame = progress === goal ? 0 : requestAnimationFrame(tick);
  }
  addEventListener("scroll", () => (frame ||= requestAnimationFrame(tick)), { passive: true });
  addEventListener("resize", () => (frame ||= requestAnimationFrame(tick)));
  render(progress);
}
