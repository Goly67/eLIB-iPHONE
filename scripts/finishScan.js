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

// Add this script to enable the top header blur on scroll
window.addEventListener('scroll', function() {
    const topHeader = document.getElementById('topHeader');
    if (window.scrollY > 20) {
        topHeader.classList.add('scrolled');
    } else {
        topHeader.classList.remove('scrolled');
    }
});

const tvCurrentTime = document.getElementById('tvCurrentTime');
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// mark token invalid on SessionsByToken so it cannot be reused
async function invalidateToken(tok, extra = {}) {
    if (!tok) return;
    try {
        const now = Date.now();
        await update(ref(db, `SessionsByToken/${tok}`), { invalidated: true, logoutTime: now, ...extra });
    } catch (e) {
        console.warn('Failed to invalidate token', e);
    }
}

// UI refs
const tvName = document.getElementById('tvStudentName');
const tvId = document.getElementById('tvStudentID');
const tvGreeting = document.getElementById('tvGreeting');
const topToast = document.getElementById('topToast');
const logoutDialog = document.getElementById('logoutDialog');
const btnLogoutYes = document.getElementById('btnLogoutYes');
const btnLogoutNo = document.getElementById('btnLogoutNo');
// ----------------- UI NOTIFICATION SYSTEM -----------------
const notifBtn = document.getElementById('notifBtn');
const notifDropdown = document.getElementById('notifDropdown');
const notifList = document.getElementById('notifList');
const notifBadge = document.getElementById('notifBadge');
const clearNotifsBtn = document.getElementById('clearNotifs');

let notifications = [];

if(notifBtn){
    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle('show');
        // Hide badge when opened
        if(notifDropdown.classList.contains('show')) {
            updateBadge(false);
        }
    });
}

document.addEventListener('click', (e) => {
    if (notifDropdown && notifDropdown.classList.contains('show')) {
        if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
            notifDropdown.classList.remove('show');
        }
    }
});

if(clearNotifsBtn) {
    clearNotifsBtn.addEventListener('click', () => {
        notifications = [];
        renderNotifications();
    });
}

function addInAppNotification(title, body) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    notifications.unshift({ title, body, time: timeStr });
    renderNotifications();
    updateBadge(true);
}

function renderNotifications() {
    if (!notifList) return;
    notifList.innerHTML = '';

    if (notifications.length === 0) {
        notifList.innerHTML = '<div class="empty-notif">No new notifications</div>';
        return;
    }

    notifications.forEach(n => {
        const item = document.createElement('div');
        item.className = 'notif-item';
        item.innerHTML = `
            <div class="notif-title">${n.title}</div>
            <div class="notif-body">${n.body}</div>
            <span class="notif-time">${n.time}</span>
        `;
        notifList.appendChild(item);
    });
}

function updateBadge(show) {
    if (!notifBadge) return;
    if (show) {
        notifBadge.textContent = notifications.length;
        notifBadge.style.display = 'flex';
    } else {
        notifBadge.style.display = 'none';
    }
}

let currentStudentName = '';
let currentStudentID = '';
let activeToken = null;
let _fullTvName = '';

// ----------------- NOTIFICATION STATE -----------------
let _reminderTimeoutId = null;
const REMINDER_DELAY_MS = 5000;
// ------------------------------------------------------

function showTopToast(msg, ms = 2500) {
    if (!topToast) return;
    topToast.textContent = msg;
    topToast.style.display = 'block';
    clearTimeout(showTopToast._t);
    showTopToast._t = setTimeout(() => topToast.style.display = 'none', ms);
}

function getFirstName(full) {
    if (!full) return '';
    return String(full).trim().split(/\s+/)[0] || '';
}

function setCurrentStudentName(name) {
    _fullTvName = (name || '').toString();
    try { localStorage.setItem('studentName', _fullTvName); } catch (e) { /* ignore */ }
    if (!tvName) return;
    tvName.style.whiteSpace = 'nowrap';
    tvName.style.overflow = 'hidden';
    tvName.style.textOverflow = 'clip';
    tvName.textContent = getFirstName(_fullTvName) || '';
}

// ------------------------------------------------------
// START NOTIFICATION LOGIC
// ------------------------------------------------------
async function startPushNotifications() {
    // 1. Check Basic Support
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    // 2. Check Permission (Must be 'granted' from previous page)
    if (Notification.permission !== 'granted') {
        console.warn('[NOTIF] Permission not granted yet.');
        return;
    }

    // 3. Ensure SW is Ready & Controlling
    try {
        // Register if needed, or just get existing
        let reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
            reg = await navigator.serviceWorker.register('/sw.js');
        }
        
        // Force wait for it to be active
        if (!navigator.serviceWorker.controller) {
            // If no controller, we can't use SW notifications reliably
            console.log('[NOTIF] Reloading to activate SW controller...');
            // A reload fixes the "first visit" issue where SW isn't ready
            window.location.reload(); 
            return;
        }
    } catch (e) {
        console.error('[NOTIF] SW Setup Error', e);
        return;
    }

    console.log(`[NOTIF] Timer started. Waiting ${REMINDER_DELAY_MS / 5000} seconds...`);

    // 4. Start Timer
    if (_reminderTimeoutId) clearTimeout(_reminderTimeoutId);
    
    _reminderTimeoutId = setTimeout(async () => {
        console.log('[NOTIF] Timer finished. Sending...');

        addInAppNotification('LIBRARY REMINDER', 'Please LOGOUT before exiting the LIBRARY.');
        
        try {
            const reg = await navigator.serviceWorker.ready;
            
            // CRITICAL: iOS requires the 'tag' to be unique or it might silence it
            // Adding a timestamp to the tag ensures it's treated as a "new" event
            const uniqueTag = 'logout-reminder-' + Date.now();

            await reg.showNotification('LIBRARY REMINDER', {
                body: 'Please LOGOUT before exiting the LIBRARY.',
                icon: 'images/icons/eLib-icon192x192.png',
                tag: uniqueTag, // Unique tag per notification
                renotify: true,
                vibrate: [200, 100, 200],
                requireInteraction: false 
            });
            
            console.log('[NOTIF] Sent via Service Worker');
            
        } catch (e) {
            console.error('[NOTIF] Failed to send', e);
            // Last ditch effort: Standard API
            new Notification('LIBRARY REMINDER', {
                body: 'Please LOGOUT before exiting the library.'
            });
        }
    }, REMINDER_DELAY_MS);
}


function stopPushNotifications() {
    if (_reminderTimeoutId) {
        clearTimeout(_reminderTimeoutId);
        _reminderTimeoutId = null;
    }
}
// ------------------------------------------------------

// Watch for resize
if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => setCurrentStudentName(_fullTvName));
    ro.observe(tvName ? (tvName.parentElement || tvName) : document.body);
} else {
    window.addEventListener('resize', () => setCurrentStudentName(_fullTvName));
}

function updateTimeAndGreeting() {
    const now = new Date();
    const hr = now.getHours();
    const greeting = hr < 12 ? 'Good Morning' : (hr < 18 ? 'Good Afternoon' : 'Good Evening');
    if (tvGreeting) tvGreeting.textContent = greeting + ',';
    if (tvCurrentTime) tvCurrentTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

updateTimeAndGreeting();
setInterval(updateTimeAndGreeting, 5000);

const params = new URLSearchParams(window.location.search);
const token = params.get('token') || null;
if (token) {
    localStorage.setItem('activeToken', token);
    activeToken = token;
} else {
    activeToken = localStorage.getItem('activeToken') || null;
}

signInAnonymously(auth).then(() => {
    showTopToast('Data gathered successfully', 1200);
    if (activeToken) {
        loadStudentFromToken(activeToken);
    } else {
        const stored = localStorage.getItem('studentNum');
        if (stored) {
            fetchStudentByNumber(stored);
        } else {
            showTopToast('No active session. Please scan first.');
            setTimeout(() => location.replace('/index.html'), 900);
        }
    }
}).catch(err => {
    console.error('Auth failed', err);
    showTopToast('Auth failed: ' + (err && err.message ? err.message : ''));
});

async function loadStudentFromToken(tok) {
    if (!tok) return;
    try {
        const snap = await get(child(ref(db), `SessionsByToken/${tok}`));
        if (!snap.exists()) {
            showTopToast('Invalid or expired token');
            return;
        }
        const data = snap.val();

        if (data.invalidated === true || data.logoutTime) {
            showTopToast('This token has already been used (logged out).');
            localStorage.removeItem('activeToken');
            localStorage.removeItem('studentNum');
            localStorage.removeItem('studentName');
            localStorage.removeItem('studentID');
            setTimeout(() => location.replace('index.html'), 850);
            return;
        }

        const name = data.name || data.studentName || data.fullName || 'Unknown';
        const studentNumber = data.studentNumber || data.id || data.studentNum || data.studentID || '';
        
        localStorage.setItem('studentNum', studentNumber);
        localStorage.setItem('studentName', name);
        localStorage.setItem('studentID', studentNumber);
        localStorage.setItem('activeToken', tok);
        currentStudentName = name; currentStudentID = studentNumber; activeToken = tok;
        setCurrentStudentName(name);
        tvId.textContent = 'ID: ' + studentNumber;
        showTopToast('Welcome ' + getFirstName(name) + '!');

        // CALL NOTIFICATION START
        startPushNotifications();

    } catch (e) {
        console.error(e);
        showTopToast('Error fetching session data');
    }
}

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
    } catch (err) {
        console.error(err);
        showTopToast('Error loading student data');
    }
}

function navHome() {
    const tok = localStorage.getItem('activeToken') || '';
    if (tok) window.location.href = `finishScanActivity.html?token=${tok}`;
    else window.location.href = 'finishScanActivity.html';
}
window.navHome = navHome;
function navBlogs() { window.open('https://www.sti.edu/blog1.asp', '_blank'); }
window.navBlogs = navBlogs;
function navFeedback() {
    const studentId = localStorage.getItem('studentID') || localStorage.getItem('studentNum') || '';
    const tok = localStorage.getItem('activeToken') || '';
    if (!studentId) { showTopToast('Student session missing. Please scan again.'); return; }
    const url = `feedback.html?studentId=${encodeURIComponent(studentId)}${tok ? '&token=' + encodeURIComponent(tok) : ''}`;
    window.location.href = url;
}
window.navFeedback = navFeedback;
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

async function performManualLogout() {
    const studentNum = localStorage.getItem('studentNum');
    const name = localStorage.getItem('studentName') || _fullTvName || '';
    if (!studentNum) {
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

        stopPushNotifications();
        localStorage.removeItem('studentNum'); localStorage.removeItem('studentName'); localStorage.removeItem('studentID'); localStorage.removeItem('activeToken');
        setTimeout(() => window.location.href = 'thankyou.html', 900);
    }
}

window.openHelp = () => window.open('https://library.sticollegesurigao.com/contact-us/', '_blank');
window.openLibrary = () => window.open('https://login.ebsco.com/', '_blank');
window.openELMS = () => window.open('https://elms.sti.edu/', '_blank');
window.openSite = () => window.open('https://library.sticollegesurigao.com/', '_blank');
window.openFeedback = () => navFeedback();
window.onBlogInfo = (i) => { if (i === 1) window.open('https://www.sti.edu/blog1.asp', '_blank'); else showTopToast('Opening blog ' + i); };
