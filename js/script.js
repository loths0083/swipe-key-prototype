const textInput = document.getElementById('text-input');
const bottomToolbar = document.getElementById('bottom-toolbar');
const indicator = document.getElementById('keyboard-indicator');
const appContainer = document.getElementById('app-container');
const swipeKey = document.getElementById('swipe-trigger-key');

let startX = 0;
let startY = 0;
const threshold = 20;
let currentAction = null;
let isFocused = false;
let cachedSelectionStart = 0;
let cachedSelectionEnd = 0;

// Prevent pinch-zoom gestures on iOS Safari
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());

// Track selection changes to preserve cursor position when focus shifts
textInput.addEventListener('selectionchange', () => {
    if (document.activeElement === textInput) {
        cachedSelectionStart = textInput.selectionStart;
        cachedSelectionEnd = textInput.selectionEnd;
    }
});

['keyup', 'click', 'input'].forEach(evt => {
    textInput.addEventListener(evt, () => {
        cachedSelectionStart = textInput.selectionStart;
        cachedSelectionEnd = textInput.selectionEnd;
    });
});

// Neutralize WebKit native auto-scroll shift on focus
function resetScrollPosition() {
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
}

window.addEventListener('scroll', resetScrollPosition);
document.body.addEventListener('scroll', resetScrollPosition);

function updateLayoutAndToolbar() {
    resetScrollPosition();
    if (!window.visualViewport) return;
    const vv = window.visualViewport;

    // Match container dimensions precisely to the visual viewport
    appContainer.style.height = vv.height + 'px';
    appContainer.style.top = vv.offsetTop + 'px';
    appContainer.style.left = vv.offsetLeft + 'px';

    const keyboardHeight = window.innerHeight - vv.height;

    if (isFocused) {
        bottomToolbar.classList.add('visible');
        
        // Pin toolbar directly to the bottom of the visual viewport (above the keyboard)
        const toolbarTop = vv.offsetTop + vv.height - bottomToolbar.offsetHeight;
        bottomToolbar.style.top = toolbarTop + 'px';
        bottomToolbar.style.left = vv.offsetLeft + 'px';
        bottomToolbar.style.width = vv.width + 'px';

        if (keyboardHeight > 50) {
            indicator.classList.add('active');
            indicator.textContent = `Keyboard Active (${Math.round(keyboardHeight)}px)`;
        } else {
            indicator.classList.add('active');
            indicator.textContent = 'Focus Mode (Desktop/No KB)';
        }
    } else {
        bottomToolbar.classList.remove('visible');
        indicator.classList.remove('active');
        indicator.textContent = 'Keyboard Status: Closed';
    }
}

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateLayoutAndToolbar);
    window.visualViewport.addEventListener('scroll', updateLayoutAndToolbar);
}

textInput.addEventListener('focus', () => {
    isFocused = true;
    updateLayoutAndToolbar();
    let frames = 0;
    function poll() {
        updateLayoutAndToolbar();
        resetScrollPosition();
        frames++;
        if (frames < 30 && isFocused) requestAnimationFrame(poll);
    }
    requestAnimationFrame(poll);
});

textInput.addEventListener('blur', () => {
    setTimeout(() => {
        if (document.activeElement !== textInput) {
            isFocused = false;
            updateLayoutAndToolbar();
        }
    }, 200);
});

// Pointer event listeners for 3-way directional swipe detection
swipeKey.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    swipeKey.setPointerCapture(e.pointerId);
    currentAction = null;
});

swipeKey.addEventListener('pointermove', (e) => {
    if (startX === 0 && startY === 0) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    const distance = Math.hypot(deltaX, deltaY);

    swipeKey.classList.remove('swiping-top', 'swiping-bottom', 'swiping-left');
    currentAction = null;

    if (distance > threshold) {
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

        if (angle >= -150 && angle <= -30) {
            currentAction = 'copy';
            swipeKey.classList.add('swiping-top');
        } else if (angle >= 30 && angle <= 150) {
            currentAction = 'paste';
            swipeKey.classList.add('swiping-bottom');
        } else {
            currentAction = 'selectAll';
            swipeKey.classList.add('swiping-left');
        }
    }
});

swipeKey.addEventListener('pointerup', () => {
    if (currentAction) {
        executeAction(currentAction);
    }

    startX = 0;
    startY = 0;
    currentAction = null;
    swipeKey.classList.remove('swiping-top', 'swiping-bottom', 'swiping-left');
});

function insertTextAtCursor(text) {
    const start = cachedSelectionStart;
    const end = cachedSelectionEnd;
    textInput.value = textInput.value.substring(0, start) + text + textInput.value.substring(end);
    textInput.setSelectionRange(start + text.length, start + text.length);
}

function executeAction(action) {
    textInput.focus();

    if (action === 'selectAll') {
        textInput.select();
    } else if (action === 'copy') {
        const selectedText = textInput.value.substring(cachedSelectionStart, cachedSelectionEnd);
        if (selectedText) {
            navigator.clipboard.writeText(selectedText).catch(err => {
                console.error('Async Clipboard write failed: ', err);
            });
        }
    } else if (action === 'paste') {
        navigator.clipboard.readText().then(text => {
            insertTextAtCursor(text);
        }).catch(err => {
            console.error('Async Clipboard read failed: ', err);
        });
    }
}