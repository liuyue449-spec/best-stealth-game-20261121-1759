// Night Ledger — keyboard and mouse input.
// One file, one job: it tracks which keys are held and where the mouse is, and
// hands the simulation one plain object per frame. It never moves anything.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    sneak: false,
    // A coin toss requested this frame, with its target in canvas pixels.
    toss: false,
    tossX: 0,
    tossY: 0,
    // Mouse position in canvas pixels (for the aim marker).
    mouseX: 0,
    mouseY: 0,
  };

  const KEYMAP = {
    ArrowUp: 'up',
    KeyW: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ShiftLeft: 'sneak',
    ShiftRight: 'sneak',
  };

  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (name) {
      keys.add(name);
      event.preventDefault();
    }
    // Q tosses a coin toward the mouse; handled by main.js through tossQueued.
    if (event.code === 'KeyQ') {
      input.toss = true;
      input.tossX = input.mouseX;
      input.tossY = input.mouseY;
    }
  }

  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (name) keys.delete(name);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    input.mouseY = ((event.clientY - rect.top) / rect.height) * canvas.height;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    if (event.button === 0) {
      input.toss = true;
      input.tossX = input.mouseX;
      input.tossY = input.mouseY;
    }
  }

  function sync() {
    input.up = keys.has('up');
    input.down = keys.has('down');
    input.left = keys.has('left');
    input.right = keys.has('right');
    input.sneak = keys.has('sneak');
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    input,
    // Call once per frame: refresh the held-key flags and clear one-shot tosses
    // after the simulation has read them.
    sync,
    consumeToss() {
      const tossed = input.toss;
      input.toss = false;
      return tossed;
    },
  };
}
