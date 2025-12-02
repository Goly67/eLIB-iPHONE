import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import { getDatabase, ref, get, push, set } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-database.js";
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

// verify token is still valid (not invalidated and not logged-out)
async function isTokenValid(tok) {
  if (!tok) return true; // no token -> allowed for local flows
  try {
    // use ref(...) directly instead of child(ref(...), ...)
    const snap = await get(ref(db, `SessionsByToken/${tok}`));
    if (!snap.exists()) {
      console.log('Token not found:', tok);
      return false;
    }
    const data = snap.val();

    // DEBUG: print the remote node once so you can inspect it in console
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
    // conservative fallback: treat as invalid to avoid accidental leaks
    return false;
  }
}


// UI refs
const tvGreeting = document.getElementById('tvGreeting');
const tvStudentName = document.getElementById('tvStudentName');
const tvStudentID = document.getElementById('tvStudentID');
const tvCurrentTime = document.getElementById('tvCurrentTime');
const greetingRow = document.getElementById('greetingRow');

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

// small helper: return the first name token
function getFirstName(full) {
    if (!full) return '';
    return String(full).trim().split(/\s+/)[0] || '';
}

// write only first name into tvStudentName and force single-line clipping (no ellipsis)
function showFirstNameOnly(full) {
    const first = getFirstName(full);
    if (!tvStudentName) return;
    // ensure single-line display and no ellipsis
    tvStudentName.style.whiteSpace = 'nowrap';
    tvStudentName.style.overflow = 'hidden';
    tvStudentName.style.textOverflow = 'clip';
    tvStudentName.textContent = first || '';
}

// toast
function showTopToast(msg, ms = 2200) {
    topToast.textContent = msg;
    topToast.style.display = 'block';
    clearTimeout(showTopToast._t);
    showTopToast._t = setTimeout(() => topToast.style.display = 'none', ms);
}

// Debounce helper (keeps things snappy on resize)
function debounce(fn, wait = 120) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); };
}

// Re-apply first-name display on resize (keeps it stable)
const debouncedReflow = debounce(() => {
    // re-show using stored full name (localStorage has the canonical full name)
    const full = localStorage.getItem('studentName') || currentStudentName || '';
    showFirstNameOnly(full);
}, 80);
window.addEventListener('resize', debouncedReflow);
window.addEventListener('orientationchange', debouncedReflow);

// Update greeting and time (time-only)
function updateGreetingAndTime() {
    const now = new Date();
    const hr = now.getHours();
    const greeting = hr < 12 ? 'Good Morning' : (hr < 18 ? 'Good Afternoon' : 'Good Evening');
    if (tvGreeting) tvGreeting.textContent = greeting + ',';
    if (tvCurrentTime) tvCurrentTime.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    // ensure display uses only the first name
    const full = localStorage.getItem('studentName') || currentStudentName || '';
    showFirstNameOnly(full);
}
updateGreetingAndTime();
setInterval(updateGreetingAndTime, 1000);

// parse incoming params
const params = new URLSearchParams(window.location.search);
const urlStudentId = params.get('studentId');
const urlToken = params.get('token');

// Keep storing token in localStorage when present (so other pages can use it)
if (urlToken) localStorage.setItem('activeToken', urlToken);

// sign-in and then verify token validity
signInAnonymously(auth).then(async () => {
  // choose token to validate: prefer URL token if present, else existing localStorage token
  const tokenToCheck = urlToken || localStorage.getItem('activeToken') || null;

  if (tokenToCheck) {
    const ok = await isTokenValid(tokenToCheck);
    if (!ok) {
      // token is invalid -> force exit to index (replace history so Back won't go back)
      showTopToast('This session token has already been used or expired.');
      // Clear any stored session info (defensive)
      try {
        localStorage.removeItem('activeToken');
        localStorage.removeItem('studentNum');
        localStorage.removeItem('studentName');
        localStorage.removeItem('studentID');
      } catch(e){ /* ignore */ }
      // brief delay so user can see toast, then replace location
      setTimeout(() => location.replace('index.html'), 900);
      return;
    }
    // token is valid -> ensure stored
    localStorage.setItem('activeToken', tokenToCheck);
    activeToken = tokenToCheck;
  }

  // continue normal flow: determine which student id to load
  const storedStudentId = localStorage.getItem('studentID') || localStorage.getItem('studentNum') || null;
  const finalStudentId = urlStudentId || storedStudentId;

  if (finalStudentId) {
    loadStudentInfo(finalStudentId);
  } else {
    showTopToast('No student ID found. Please scan first.');
    setTimeout(() => window.location.href = 'secondScanActivity.html', 900);
  }
}).catch(err => {
  console.error(err);
  showTopToast('Auth failed: ' + (err && err.message ? err.message : ''));
});

async function loadStudentInfo(studentId) {
    try {
        const snap = await get(ref(db, `Students/${studentId}`));
        if (snap.exists()) {
            const d = snap.val();
            const name = (d.name || d.fullName || localStorage.getItem('studentName') || '').trim();
            const id = d.studentNumber || d.studentID || studentId;
            currentStudentName = name || '';
            currentStudentID = id || '';

            // show ONLY first name
            showFirstNameOnly(currentStudentName || 'Unknown');
            tvStudentID.textContent = 'ID: ' + (currentStudentID || '');
            etStudentNumber.value = currentStudentID || '';

            // persist full name for DB uses
            localStorage.setItem('studentNum', studentId);
            localStorage.setItem('studentID', currentStudentID);
            localStorage.setItem('studentName', currentStudentName);

            // ensure layout remains correct
            debouncedReflow();

        } else {
            // Use stored full name if DB not found, but display first name only
            const storedFull = localStorage.getItem('studentName') || 'Unknown';
            showFirstNameOnly(storedFull);
            tvStudentID.textContent = 'ID: ' + (studentId || '');
            etStudentNumber.value = studentId || '';
            currentStudentName = storedFull;
            currentStudentID = studentId || '';
            showTopToast('Student record not found; using provided ID');
            debouncedReflow();
        }
    } catch (err) {
        console.error(err);
        showTopToast('Error fetching student info');
    }
}

// Submit feedback
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
        // keep full name in DB
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

// Nav helpers (drawables)
function navHome() {
    const tok = localStorage.getItem('activeToken') || '';
    if (tok) window.location.href = `finishScanActivity.html?token=${tok}`;
    else window.location.href = 'finishScanActivity.html';
}
function navBlogs() { window.open('https://www.sti.edu/blog1.asp', '_blank'); }
function navFeedback() { showTopToast('You are on Feedback'); }
// Logout flow (with Firebase session update)
function navLogout() {
    logoutDialog.style.display = 'flex';
    requestAnimationFrame(() => logoutDialog.classList.add('show'));
    logoutDialog.setAttribute('aria-hidden', 'false');
}

btnLogoutYes.addEventListener('click', async () => {
    hideLogoutDialog(async () => {
        const studentNum = localStorage.getItem('studentNum');
        const name = localStorage.getItem('studentName') || currentStudentName || 'Unknown';
        const activeToken = localStorage.getItem('activeToken');
        const now = Date.now();
        const humanDate = new Date(now).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        try {
            if (studentNum) {
                // Try to update the latest session in Students/{studentNum}/sessions
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
            // clear localStorage & redirect
            localStorage.removeItem('studentNum');
            localStorage.removeItem('studentName');
            localStorage.removeItem('studentID');
            localStorage.removeItem('activeToken');
            setTimeout(() => window.location.href = 'thankyou.html', 900);
        }
    });
});

btnLogoutNo.addEventListener('click', () => {
    logoutDialog.classList.remove('show');
    logoutDialog.setAttribute('aria-hidden', 'true');
});

// helper to hide dialog
function hideLogoutDialog(callback) {
    logoutDialog.classList.remove('show');
    logoutDialog.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
        logoutDialog.style.display = 'none';
        if (callback) callback();
    }, 260);
}

// make nav helpers available for inline onclicks
window.navHome = navHome;
window.navBlogs = navBlogs;
window.navFeedback = navFeedback;
window.navLogout = navLogout;
