import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import { getDatabase, ref, get, push, set, update } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-database.js";
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

// ============ NOTIFICATION SYSTEM ============
let _reminderTimeoutId = null;
const REMINDER_DELAY_MS = 5000;
let notifications = [];

const notifBtn = document.getElementById('notifBtn');
const notifDropdown = document.getElementById('notifDropdown');
const notifList = document.getElementById('notifList');
const notifBadge = document.getElementById('notifBadge');
const clearNotifsBtn = document.getElementById('clearNotifs');

// Toggle Dropdown
if (notifBtn) {
    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle('show');
        if (notifDropdown.classList.contains('show')) updateBadge(false);
    });
}

// Close Dropdown on outside click
document.addEventListener('click', (e) => {
    if (notifDropdown && notifDropdown.classList.contains('show')) {
        if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
            notifDropdown.classList.remove('show');
        }
    }
});

// Clear Notifications
if (clearNotifsBtn) {
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

// Start Push Notifications Timer
async function startPushNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    if (Notification.permission !== 'granted') {
        console.warn('[NOTIF] Permission not granted yet.');
        return;
    }

    try {
        let reg = await navigator.serviceWorker.getRegistration();
        if (!reg) reg = await navigator.serviceWorker.register('/sw.js');

        console.log('[NOTIF] Timer started.');

        if (_reminderTimeoutId) clearTimeout(_reminderTimeoutId);

        _reminderTimeoutId = setTimeout(async () => {
            // 1. Add to UI notification list
            addInAppNotification('LIBRARY REMINDER', 'Please LOGOUT before exiting the LIBRARY.');

            // 2. Send system push notification
            try {
                const r = await navigator.serviceWorker.ready;
                const uniqueTag = 'logout-reminder-' + Date.now();
                await r.showNotification('LIBRARY REMINDER', {
                    body: 'Please LOGOUT before exiting the LIBRARY.',
                    icon: 'drawables/eLib-icon.png',
                    tag: uniqueTag,
                    renotify: true,
                    vibrate: [200, 100, 200]
                });
            } catch (e) {
                console.error('[NOTIF] Failed to send system push', e);
                new Notification('LIBRARY REMINDER', { body: 'Please LOGOUT before exiting.' });
            }
        }, REMINDER_DELAY_MS);

    } catch (e) {
        console.error('[NOTIF] Error setting up', e);
    }
}

function stopPushNotifications() {
    if (_reminderTimeoutId) {
        clearTimeout(_reminderTimeoutId);
        _reminderTimeoutId = null;
    }
}

// ============ VERIFY TOKEN ============
async function isTokenValid(tok) {
    if (!tok) return true;
    try {
        const snap = await get(ref(db, `SessionsByToken/${tok}`));
        if (!snap.exists()) {
            console.log('Token not found:', tok);
            return false;
        }

        const data = snap.val();
        console.debug('SessionsByToken entry for', tok, data);

        if (data && data.invalidated === true) {
            console.log('Token explicitly invalidated:', tok);
            return false;
        }

        if (data && typeof data.logoutTime === 'number' && data.logoutTime > 0) {
            console.log('Token has logoutTime > 0 (used):', tok, data.logoutTime);
            return false;
        }

        return true;
    } catch (err) {
        console.error('Token validation failed', err);
        return false;
    }
}

// ============ UI REFS ============
const tvGreeting = document.getElementById('tvGreeting');
const tvStudentName = document.getElementById('tvStudentName');
const tvStudentID = document.getElementById('tvStudentID');
const tvCurrentTime = document.getElementById('tvCurrentTime');
const etStudentNumber = document.getElementById('etStudentNumber');
const etSubject = document.getElementById('etSubject');
const etDescription = document.getElementById('etDescription');
const btnSubmitFeedback = document.getElementById('btnSubmitFeedback');
const topToast = document.getElementById('topToast');
const logoutDialog = document.getElementById('logoutDialog');
const btnLogoutYes = document.getElementById('btnLogoutYes');
const btnLogoutNo = document.getElementById('btnLogoutNo');

let currentStudentName = '';
let currentStudentID = '';
let activeToken = null;

// ============ HELPERS ============
function getFirstName(full) {
    if (!full) return '';
    return String(full).trim().split(/\s+/)[0] || '';
}

function showFirstNameOnly(full) {
    const first = getFirstName(full);
    if (!tvStudentName) return;
    tvStudentName.style.whiteSpace = 'nowrap';
    tvStudentName.style.overflow = 'hidden';
    tvStudentName.style.textOverflow = 'clip';
    tvStudentName.textContent = first || '';
}

function showTopToast(msg, ms = 2200) {
    if (!topToast) return;
    topToast.textContent = msg;
    topToast.style.display = 'block';
    clearTimeout(showTopToast._t);
    showTopToast._t = setTimeout(() => topToast.style.display = 'none', ms);
}

// ============ UPDATE TIME & GREETING ============
function updateGreetingAndTime() {
    const now = new Date();
    const hr = now.getHours();
    const greeting = hr < 12 ? 'Good Morning' : (hr < 18 ? 'Good Afternoon' : 'Good Evening');

    if (tvGreeting) tvGreeting.textContent = greeting + ',';
    if (tvCurrentTime) tvCurrentTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const full = localStorage.getItem('studentName') || currentStudentName || '';
    showFirstNameOnly(full);
}

updateGreetingAndTime();
setInterval(updateGreetingAndTime, 1000);

// ============ LOAD STUDENT DATA ============
const params = new URLSearchParams(window.location.search);
const urlStudentId = params.get('studentId');
const urlToken = params.get('token');

if (urlToken) localStorage.setItem('activeToken', urlToken);

signInAnonymously(auth).then(async () => {
    const tokenToCheck = urlToken || localStorage.getItem('activeToken') || null;

    if (tokenToCheck) {
        const ok = await isTokenValid(tokenToCheck);
        if (!ok) {
            showTopToast('This session token has already been used or expired.');
            try {
                localStorage.removeItem('activeToken');
                localStorage.removeItem('studentNum');
                localStorage.removeItem('studentName');
                localStorage.removeItem('studentID');
            } catch (e) { }
            setTimeout(() => location.replace('index.html'), 900);
            return;
        }
        localStorage.setItem('activeToken', tokenToCheck);
        activeToken = tokenToCheck;
    }

    const storedStudentId = localStorage.getItem('studentID') || localStorage.getItem('studentNum') || null;
    const finalStudentId = urlStudentId || storedStudentId;

    if (finalStudentId) {
        loadStudentInfo(finalStudentId);
        // Start notification timer
        startPushNotifications();
    } else {
        showTopToast('No student ID found. Please scan first.');
        setTimeout(() => window.location.href = 'finishScanActivity.html', 900);
    }

}).catch(err => {
    console.error(err);
    showTopToast('Auth failed: ' + (err && err.message ? err.message : ''));
});

// 1) Confirm bottomNav parent
console.log('bottomNav parent:', document.querySelector('#bottomNav').parentElement);

// 2) Find nearest ancestor that uses transform/filter/will-change/perspective
let el = document.querySelector('#bottomNav');
while (el) {
    const s = getComputedStyle(el);
    if (s.transform !== 'none' || s.filter !== 'none' || /will-change/.test(s.willChange) || s.perspective !== 'none') {
        console.warn('Transform/filter/will-change/perspective found on:', el, s.transform, s.filter, s.willChange, s.perspective);
        break;
    }
    el = el.parentElement;
}
if (!el) console.log('No transform/filter/will-change/perspective found up the tree.');


async function loadStudentInfo(studentId) {
    try {
        const snap = await get(ref(db, `Students/${studentId}`));
        if (snap.exists()) {
            const d = snap.val();
            const name = (d.name || d.fullName || localStorage.getItem('studentName') || '').trim();
            const id = d.studentNumber || d.studentID || studentId;

            currentStudentName = name || '';
            currentStudentID = id || '';

            showFirstNameOnly(currentStudentName || 'Unknown');
            tvStudentID.textContent = 'ID: ' + (currentStudentID || '');
            etStudentNumber.value = currentStudentID || '';

            localStorage.setItem('studentNum', studentId);
            localStorage.setItem('studentID', currentStudentID);
            localStorage.setItem('studentName', currentStudentName);
        } else {
            const storedFull = localStorage.getItem('studentName') || 'Unknown';
            showFirstNameOnly(storedFull);
            tvStudentID.textContent = 'ID: ' + (studentId || '');
            etStudentNumber.value = studentId || '';
            currentStudentName = storedFull;
            currentStudentID = studentId || '';
            showTopToast('Student record not found; using provided ID');
        }
    } catch (err) {
        console.error(err);
        showTopToast('Error fetching student info');
    }
}

// ============ SUBMIT FEEDBACK ============
btnSubmitFeedback.addEventListener('click', async () => {
    const subject = etSubject.value.trim();
    const description = etDescription.value.trim();
    const studentNum = currentStudentID || etStudentNumber.value.trim();

    if (!subject || !description) { showTopToast('Please fill all fields'); return; }
    if (!studentNum) { showTopToast('Student ID missing'); return; }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const date = `${yyyy}-${mm}-${dd}`;

    const payload = {
        name: currentStudentName || localStorage.getItem('studentName') || 'Unknown',
        studentNumber: studentNum,
        subject,
        description,
        date
    };

    try {
        const newRef = push(ref(db, 'Feedbacks'));
        await set(newRef, payload);
        showTopToast('Feedback submitted');
        etSubject.value = '';
        etDescription.value = '';
    } catch (e) {
        console.error('Submit failed', e);
        showTopToast('Failed to submit feedback');
    }
});

// ============ NAV HELPERS ============
function navHome() {
    const tok = localStorage.getItem('activeToken') || '';
    if (tok) window.location.href = `finishScanActivity.html?token=${tok}`;
    else window.location.href = 'finishScanActivity.html';
}

function navBlogs() { window.open('https://www.sti.edu/blog1.asp', '_blank'); }

function navFeedback() { showTopToast('You are on Feedback'); }

// ============ LOGOUT FLOW ============
function navLogout() {
    logoutDialog.style.display = 'flex';
    requestAnimationFrame(() => logoutDialog.classList.add('show'));
    logoutDialog.setAttribute('aria-hidden', 'false');
}

btnLogoutYes.addEventListener('click', async () => {
    hideLogoutDialog(async () => {
        const studentNum = localStorage.getItem('studentNum');
        const name = localStorage.getItem('studentName') || currentStudentName || 'Unknown';
        const activeTokenVal = localStorage.getItem('activeToken');
        const now = Date.now();
        const humanDate = new Date(now).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        try {
            if (studentNum) {
                const sessionsSnap = await get(ref(db, `Students/${studentNum}/sessions`));
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

                const sessionData = { logoutTime: now, date: humanDate, name, studentNumber: studentNum };

                if (candidateKey) {
                    await set(ref(db, `Students/${studentNum}/sessions/${candidateKey}/logoutTime`), now);
                    await set(ref(db, `StudentLogs/${studentNum}/${candidateKey}/logoutTime`), now).catch(() => { });
                    showTopToast('Logout recorded (session updated)');
                } else {
                    const newRef = push(ref(db, `StudentLogs/${studentNum}`));
                    const key = newRef.key;
                    const payload = { date: humanDate, grade: '', loginTime: now, logoutTime: now, name, strand: '', studentNumber: studentNum };
                    await set(ref(db, `StudentLogs/${studentNum}/${key}`), payload);
                    await set(ref(db, `Students/${studentNum}/sessions/${key}`), payload);
                    showTopToast('Logout recorded (new session)');
                }
            }
        } catch (e) {
            console.error('Logout write error', e);
            showTopToast('Failed to record logout to DB');
        } finally {
            // Invalidate token
            try {
                const tok = activeTokenVal || localStorage.getItem('activeToken');
                if (tok) {
                    await update(ref(db, `SessionsByToken/${tok}`), { invalidated: true, logoutTime: now });
                }
            } catch (e) {
                console.warn('Token invalidate failed:', e);
            }

            stopPushNotifications();
            localStorage.removeItem('studentNum');
            localStorage.removeItem('studentName');
            localStorage.removeItem('studentID');
            localStorage.removeItem('activeToken');

            setTimeout(() => window.location.href = 'thankyou.html', 900);
        }
    });
});

btnLogoutNo.addEventListener('click', () => {
    hideLogoutDialog();
});

function hideLogoutDialog(callback) {
    logoutDialog.classList.remove('show');
    logoutDialog.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
        logoutDialog.style.display = 'none';
        if (callback) callback();
    }, 260);
}

window.openHelp = () => window.open('https://library.sticollegesurigao.com/contact-us/', '_blank');
window.openLibrary = () => window.open('https://login.ebsco.com/', '_blank');
window.openELMS = () => window.open('https://elms.sti.edu/', '_blank');
window.openSite = () => window.open('https://library.sticollegesurigao.com/', '_blank');
window.openFeedback = () => navFeedback();
window.onBlogInfo = (i) => { if (i === 1) window.open('https://www.sti.edu/blog1.asp', '_blank'); else showTopToast('Opening blog ' + i); };

// Make nav helpers available for inline onclicks
window.navHome = navHome;
window.navBlogs = navBlogs;
window.navFeedback = navFeedback;
window.navLogout = navLogout;
