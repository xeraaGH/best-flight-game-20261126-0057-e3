// Gale Strip — keyboard (primary) and mouse (menus) input.
// Arrows / WASD fly the plane: Up/Down pitch, Left/Right roll, W/S throttle.
// F flaps, G gear, P pause, R restart, Enter confirms a menu.
// Arrows fly pitch and roll; A/D roll; W/S work the throttle lever.
export const KEY_PITCH_UP = ['ArrowUp'];
export const KEY_PITCH_DOWN = ['ArrowDown'];
export const KEY_ROLL_LEFT = ['ArrowLeft', 'KeyA'];
export const KEY_ROLL_RIGHT = ['ArrowRight', 'KeyD'];

export function createInputState() {
  return {
    pitchUp: false,
    pitchDown: false,
    rollLeft: false,
    rollRight: false,
    throttleUp: false,
    throttleDown: false,
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseClicked: false,
  };
}

// Read the live keyboard into `state` every frame; `pressed` holds keys that
// went down since the last consume, so taps (flaps, gear, pause) fire once.
export function attachKeyboardInput(target, state) {
  const down = (event) => {
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown' || event.code === 'Space') {
      event.preventDefault();
    }
    state.pressed.add(event.code);
    if (KEY_PITCH_UP.includes(event.code)) state.pitchUp = true;
    if (KEY_PITCH_DOWN.includes(event.code)) state.pitchDown = true;
    if (KEY_ROLL_LEFT.includes(event.code)) state.rollLeft = true;
    if (KEY_ROLL_RIGHT.includes(event.code)) state.rollRight = true;
    if (event.code === 'KeyW') state.throttleUp = true;
    if (event.code === 'KeyS') state.throttleDown = true;
  };
  const up = (event) => {
    if (KEY_PITCH_UP.includes(event.code)) state.pitchUp = false;
    if (KEY_PITCH_DOWN.includes(event.code)) state.pitchDown = false;
    if (KEY_ROLL_LEFT.includes(event.code)) state.rollLeft = false;
    if (KEY_ROLL_RIGHT.includes(event.code)) state.rollRight = false;
    if (event.code === 'KeyW') state.throttleUp = false;
    if (event.code === 'KeyS') state.throttleDown = false;
  };
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  return () => {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
  };
}

export function attachMouseInput(canvas, state) {
  const move = (event) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = event.clientX - rect.left;
    state.mouseY = event.clientY - rect.top;
  };
  const click = (event) => {
    move(event);
    state.mouseClicked = true;
  };
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('click', click);
  return () => {
    canvas.removeEventListener('mousemove', move);
    canvas.removeEventListener('click', click);
  };
}

// True once when `code` was tapped since the last call; clears the tap.
export function consumeKeyPress(state, code) {
  if (state.pressed.has(code)) {
    state.pressed.delete(code);
    return true;
  }
  return false;
}

// True once when the mouse was clicked since the last call; clears the click.
export function consumeMouseClick(state) {
  if (state.mouseClicked) {
    state.mouseClicked = false;
    return true;
  }
  return false;
}
