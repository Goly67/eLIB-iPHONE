import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import { getDatabase, ref, get, child, set, update, push } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDsYm9spjswfNVT_VvTprGI0Ystc3iQXQA",
    authDomain: "realtime-database-7e415.firebaseapp.com",
    databaseURL: "https://realtime-database-7e415-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "realtime-database-7e415",
    storageBucket: "realtime-database-7e415.appspot.com",
    messagingSenderId: "817516970962",
    appId: "1:817516970962:web:13b35185538cd472eebe0b"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// mark token invalid on SessionsByToken so it cannot be reused
async function invalidateToken(tok, extra = {}) {
  if (!tok) return;
  try {
    const now = Date.now();
    await update(ref(db, `SessionsByToken/${tok}`), { invalidated: true, logoutTime: now, ...extra });
    console.log('Token invalidated:', tok);
  } catch (e) {
    console.warn('Failed to invalidate token', e);
  }
}


// UI refs
const tvCurrentTime = document.getElementById('tvCurrentTime');
const tvName = document.getElementById('tvStudentName');
const tvId = document.getElementById('tvStudentID');
const tvGreeting = document.getElementById('tvGreeting');
const topToast = document.getElementById('topToast');
const logoutDialog = document.getElementById('logoutDialog');
const btnLogoutYes = document.getElementById('btnLogoutYes');
const btnLogoutNo = document.getElementById('btnLogoutNo');
const askModal = document.getElementById('askStudentModal');
const askInput = document.getElementById('askStudentInput');
const askSave = document.getElementById('askStudentSave');
const askCancel = document.getElementById('askStudentCancel');

let currentStudentName = '';
let currentStudentID = '';
let activeToken = null;

// store canonical full name (for DB uses) while showing first name only on UI
let _fullTvName = '';

// ----------------- PUSH / NOTIFICATION STATE -----------------
let _swRegistration = null;
let _pushIntervalId = null;            // the 30s interval id
const PUSH_INTERVAL_MS = 30 * 1000;    // 30 seconds as requested
// -------------------------------------------------------------

// helper: toast
function showTopToast(msg, ms = 2500) {
    if (!topToast) return;
    topToast.textContent = msg;
    topToast.style.display = 'block';
    clearTimeout(showTopToast._t);
    showTopToast._t = setTimeout(() => topToast.style.display = 'none', ms);
}

// small helper: return first token of a full name (or empty string)
function getFirstName(full) {
    if (!full) return '';
    return String(full).trim().split(/\s+/)[0] || '';
}

// Public: store full name for DB and show only the first name in the UI
function setCurrentStudentName(name) {
    _fullTvName = (name || '').toString();
    try { localStorage.setItem('studentName', _fullTvName); } catch (e) { /* ignore */ }

    if (!tvName) return;
    tvName.style.whiteSpace = 'nowrap';
    tvName.style.overflow = 'hidden';
    tvName.style.textOverflow = 'clip';
    tvName.textContent = getFirstName(_fullTvName) || '';
}

// start web notifications (register SW, request permission, then show every 30s)
async function startPushNotifications() {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported in this browser.');
        return;
    }
    if (!('serviceWorker' in navigator)) {
        console.warn('Service workers not supported in this browser.');
        return;
    }

    // If already running, don't start again
    if (_pushIntervalId) return;

    // Ask permission
    try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
            console.warn('Notification permission not granted:', perm);
            return;
        }
    } catch (e) {
        console.warn('Notification permission request failed', e);
        return;
    }

    // Register service worker (ensure sw.js exists at site root)
    try {
        _swRegistration = await navigator.serviceWorker.register('scripts/sw.js');
        console.log('Service worker registered:', _swRegistration);
    } catch (e) {
        console.error('Service worker registration failed', e);
        _swRegistration = null;
        return;
    }

    // Immediately show one, then repeat every 30s
    try {
        const sendNotif = () => {
            if (!_swRegistration) return;
            // Use registration.showNotification for best behavior
            try {
                _swRegistration.showNotification('PLEASE LOGOUT BEFORE EXITING THE LIBRARY', {
                    body: 'Please logout before exiting the library',
                    tag: 'logout-reminder', // tag allows replacement behavior on some browsers
                    renotify: true,
                    requireInteraction: true // keeps notification visible on many browsers
                });
            } catch (e) {
                // fallback to window Notification if SW fails
                try {
                    new Notification('PLEASE LOGOUT BEFORE EXITING THE LIBRARY', {
                        body: 'Please logout before exiting the library',
                        requireInteraction: true
                    });
                } catch (er) {
                    console.warn('Could not show notification', er);
                }
            }
        };

        // show immediately
        sendNotif();
        // schedule repeated reminders every 30s
        _pushIntervalId = setInterval(sendNotif, PUSH_INTERVAL_MS);

        console.log('Push reminder started (every 30s).');
    } catch (e) {
        console.error('Starting push loop failed', e);
    }
}

// stop the repeating notifications
async function stopPushNotifications() {
    if (_pushIntervalId) {
        clearInterval(_pushIntervalId);
        _pushIntervalId = null;
    }

    // optionally clear existing notifications from SW
    try {
        if (_swRegistration && _swRegistration.getNotifications) {
            const notifs = await _swRegistration.getNotifications({ tag: 'logout-reminder' });
            notifs.forEach(n => n.close());
        }
    } catch (e) {
        console.warn('Clearing notifications failed', e);
    }
}

// Watch for container/viewport resize so we can re-apply the first-name display (keeps it stable)
if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => setCurrentStudentName(_fullTvName));
    ro.observe(tvName ? (tvName.parentElement || tvName) : document.body);
} else {
    // fallback
    window.addEventListener('resize', () => setCurrentStudentName(_fullTvName));
}

//
// time + greeting
//
function updateTimeAndGreeting() {
    const now = new Date();
    if (tvCurrentTime) tvCurrentTime.textContent = now.toLocaleTimeString();
    const hr = now.getHours();
    if (tvGreeting) tvGreeting.textContent = hr < 12 ? 'Good Morning,' : (hr < 18 ? 'Good Afternoon,' : 'Good Evening,');
}
updateTimeAndGreeting();
setInterval(updateTimeAndGreeting, 1000);

// read token from URL
const params = new URLSearchParams(window.location.search);
const token = params.get('token') || null;
if (token) {
    localStorage.setItem('activeToken', token);
    activeToken = token;
} else {
    activeToken = localStorage.getItem('activeToken') || null;
}

// ask modal controls
function openAskModal() {
    if (!askModal) return;
    askModal.style.display = 'flex';
    askInput.value = '';
    askInput.focus();
}
function closeAskModal() { if (askModal) askModal.style.display = 'none'; }

askSave.addEventListener('click', () => {
    const v = askInput.value.trim();
    if (!v) { showTopToast('Enter ID'); return; }
    localStorage.setItem('studentNum', v);
    fetchStudentByNumber(v);
    closeAskModal();
});
askCancel.addEventListener('click', () => { closeAskModal(); showTopToast('Student ID required'); });

// Firebase: sign in
signInAnonymously(auth).then(() => {
    showTopToast('Data gathered successfully', 1200);
    // If token present, load session; else try loadStudentData (localStorage)
    if (activeToken) {
        loadStudentFromToken(activeToken);
    } else {
        const stored = localStorage.getItem('studentNum');
        if (stored) fetchStudentByNumber(stored);
        else openAskModal();
    }
}).catch(err => {
    console.error('Auth failed', err);
    showTopToast('Auth failed: ' + (err && err.message ? err.message : ''));
});

// small logout monitor simplified (we already have a monitor in other code but notifications are separate)
let _sessionLoginTime = null;

// load student from SessionsByToken/{token}
async function loadStudentFromToken(tok) {
    if (!tok) return;
    try {
        const snap = await get(child(ref(db), `SessionsByToken/${tok}`));
        if (!snap.exists()) {
            showTopToast('Invalid or expired token');
            openAskModal();
            return;
        }
        const data = snap.val();

        // If token already invalidated or logoutTime exists -> refuse
        if (data.invalidated === true || data.logoutTime) {
            showTopToast('This token has already been used (logged out).');
            // clear any local session state and force user back to index
            localStorage.removeItem('activeToken');
            localStorage.removeItem('studentNum');
            localStorage.removeItem('studentName');
            localStorage.removeItem('studentID');
            // replace history so back cannot return to finishScanActivity
            setTimeout(() => location.replace('index.html'), 850);
            return;
        }

        const name = data.name || data.studentName || data.fullName || 'Unknown';
        const studentNumber = data.studentNumber || data.id || data.studentNum || data.studentID || '';
        // save to localStorage
        localStorage.setItem('studentNum', studentNumber);
        localStorage.setItem('studentName', name);
        localStorage.setItem('studentID', studentNumber);
        localStorage.setItem('activeToken', tok);
        currentStudentName = name; currentStudentID = studentNumber; activeToken = tok;
        setCurrentStudentName(name); // shows first name only
        tvId.textContent = 'ID: ' + studentNumber;
        showTopToast('Welcome ' + getFirstName(name) + '!');

        // Save login time (if provided) for any logic; otherwise Date.now()
        const loginTimeFromDb = typeof data.loginTime === 'number' ? data.loginTime : (data.loginTime ? Number(data.loginTime) : null);
        _sessionLoginTime = loginTimeFromDb || Date.now();

        // START the 30s push notifications (annoying reminders)
        startPushNotifications();

    } catch (e) {
        console.error(e);
        showTopToast('Error fetching session data');
        openAskModal();
    }
}

// fetch Students/{studentNum}
async function fetchStudentByNumber(studentNum) {
    if (!studentNum) return;
    try {
        const snap = await get(child(ref(db), `Students/${studentNum}`));
        if (!snap.exists()) {
            localStorage.setItem('studentNum', studentNum);
            localStorage.setItem('studentID', studentNum);
            setCurrentStudentName('Not Found');
            tvId.textContent = 'ID: ' + studentNum;
            showTopToast('Student not found in DB, but stored locally');
            return;
        }
        const d = snap.val();
        const name = d.name || d.fullName || d.displayName || 'Unknown';
        const id = d.studentNumber || d.studentID || studentNum;
        currentStudentName = name;
        currentStudentID = id;
        localStorage.setItem('studentNum', studentNum);
        localStorage.setItem('studentName', name);
        localStorage.setItem('studentID', id);
        setCurrentStudentName(name);
        tvId.textContent = 'ID: ' + id;
        showTopToast('Data loaded successfully');

        // start notifications if you want when fetching by manual ID (optional)
        // startPushNotifications();

    } catch (err) {
        console.error(err);
        showTopToast('Error loading student data');
    }
}

/* NAV helpers requested */
// return to home and keep token in URL
function navHome() {
    const tok = localStorage.getItem('activeToken') || '';
    if (tok) window.location.href = `finishScanActivity.html?token=${tok}`;
    else window.location.href = 'finishScanActivity.html';
}
window.navHome = navHome;

// open blogs
function navBlogs() { window.open('https://www.sti.edu/blog1.asp', '_blank'); }
window.navBlogs = navBlogs;

// feedback: auto-redirect to feedback.html with studentId & token
function navFeedback() {
    const studentId = localStorage.getItem('studentID') || localStorage.getItem('studentNum') || '';
    const tok = localStorage.getItem('activeToken') || '';
    if (!studentId) { showTopToast('Student session missing. Please scan again.'); return; }
    const url = `feedback.html?studentId=${encodeURIComponent(studentId)}${tok ? '&token=' + encodeURIComponent(tok) : ''}`;
    window.location.href = url;
}
window.navFeedback = navFeedback;

// logout flow (dialog)
function navLogout() {
    if (!logoutDialog) return;
    logoutDialog.style.display = 'flex';
    requestAnimationFrame(() => logoutDialog.classList.add('show'));
    logoutDialog.setAttribute('aria-hidden', 'false');
}
window.navLogout = navLogout;

function hideLogoutDialog(callback) {
    if (!logoutDialog) { if (callback) callback(); return; }
    logoutDialog.classList.remove('show');
    logoutDialog.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
        logoutDialog.style.display = 'none';
        if (callback) callback();
    }, 260);
}
btnLogoutYes.addEventListener('click', () => {
    hideLogoutDialog(() => performManualLogout());
});
btnLogoutNo.addEventListener('click', () => {
    hideLogoutDialog(() => { });
});

// adapted performManualLogout (updates Students/{studentNum}/sessions and StudentLogs)
async function performManualLogout() {
    const studentNum = localStorage.getItem('studentNum');
    // For DB writes use stored full name (not the displayed first name)
    const name = localStorage.getItem('studentName') || _fullTvName || '';
    if (!studentNum) {
        // final fallback: clear local and redirect
        localStorage.removeItem('studentNum'); localStorage.removeItem('studentName'); localStorage.removeItem('studentID');
        showTopToast('Logged out');
        setTimeout(() => window.location.href = 'thankyou.html', 700);
        return;
    }
    const now = Date.now();
    const humanDate = new Date(now).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    try {
        const sessionsSnap = await get(child(ref(db), `Students/${studentNum}/sessions`));
        let candidateKey = null;
        if (sessionsSnap.exists()) {
            const sessions = sessionsSnap.val();
            let latestLogin = -1;
            Object.entries(sessions).forEach(([k, v]) => {
                if (v && (!v.logoutTime || v.logoutTime === 0)) {
                    const lt = typeof v.loginTime === 'number' ? v.loginTime : 0;
                    if (lt >= latestLogin) { latestLogin = lt; candidateKey = k; }
                }
            });
        }
        if (candidateKey) {
            const sessionUpdates = { logoutTime: now, date: humanDate, name, studentNumber: studentNum };
            await update(ref(db, `Students/${studentNum}/sessions/${candidateKey}`), sessionUpdates);
            await update(ref(db, `StudentLogs/${studentNum}/${candidateKey}`), sessionUpdates).catch(() => { });
            showTopToast('Logout recorded (session updated)');
        } else {
            const newRef = push(ref(db, `StudentLogs/${studentNum}`));
            const key = newRef.key;
            const payload = { date: humanDate, grade: '', loginTime: now, logoutTime: now, name, strand: '', studentNumber: studentNum };
            await set(ref(db, `StudentLogs/${studentNum}/${key}`), payload);
            await set(ref(db, `Students/${studentNum}/sessions/${key}`), payload);
            showTopToast('Logout recorded (new session)');
        }
    } catch (e) {
        console.error('Logout write error', e);
        showTopToast('Failed to record logout to DB');
    } finally {
        try {
            const tok = activeToken || localStorage.getItem('activeToken');
            await invalidateToken(tok);
        } catch(e) {
            console.warn("Token invalidate failed:", e);
        }

        // stop notifications and clear session
        await stopPushNotifications();
        localStorage.removeItem('studentNum'); localStorage.removeItem('studentName'); localStorage.removeItem('studentID'); localStorage.removeItem('activeToken');
        setTimeout(() => window.location.href = 'thankyou.html', 900);
    }
}

setInterval(() => {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage("trigger-push");
  }
}, 30000);

/* small utility actions */
window.openHelp = () => window.open('https://library.sticollegesurigao.com/contact-us/', '_blank');
window.openLibrary = () => window.open('https://login.ebsco.com/', '_blank');
window.openELMS = () => window.open('https://elms.sti.edu/', '_blank');
window.openSite = () => window.open('https://library.sticollegesurigao.com/', '_blank');
window.openFeedback = () => navFeedback();
window.onBlogInfo = (i) => { if (i === 1) window.open('https://www.sti.edu/blog1.asp', '_blank'); else showTopToast('Opening blog ' + i); };
