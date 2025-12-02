import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import { getDatabase, ref, get, child, push, set } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-database.js";
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

const studentNumber = document.getElementById('studentNumber');
const studentName = document.getElementById('studentName');
const strandSelect = document.getElementById('strandSelect');
const gradeSelect = document.getElementById('gradeSelect');
const btnSubmit = document.getElementById('btnSubmit');
const topToast = document.getElementById('topToast');

let currentFullStrand = null;

// QR token from scan.html
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

// Check if token exists in URL
if (!token) {
    alert('Unauthorized access. Please scan QR code first.');
    window.location.href = 'index.html';
    throw new Error('No QR token found');
}

const validToken = sessionStorage.getItem('qrSessionToken');
if (validToken !== token) {
    alert('Invalid session. Please scan QR code first.');
    window.location.href = 'index.html';
    throw new Error('Invalid QR token');
}

/*
    (function () {
      const ua = navigator.userAgent || navigator.vendor || window.opera;
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

      if (!isIOS) {
        document.body.innerHTML = `
        <div class="overlay"></div>  
<div class="content">
  <div class="access-denied-card">
    <img src="drawables/ios-logo.png" alt="iOS Logo" class="ios-logo">
    <h1>Access Denied</h1>
    <p>This website is only available on iOS devices, if you are using an android please download the app.</p>
    <button onclick="window.location.href='https://www.apple.com/ios/'" class="learn-more-btn">
      Learn More About iOS
    </button>
  </div>
</div>
        `;
        throw new Error('Non-iOS device detected. Access denied.');
      }
    })();

if (!token) {
    alert('Unauthorized access. Please scan QR code first.');
    window.location.href = 'scan.html';
} else {
    sessionStorage.setItem('qrSessionToken', token); // <-- save token
} */

function triggerNotification(title, body) {
    if (Notification.permission === 'granted') {
        // Try Service Worker first (better for Mobile/PWA)
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIF', // You might need to handle this in sw.js or just use showNotification directly
                title: title,
                body: body
            });
            // Direct SW fallback if postMessage isn't set up for this
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, {
                    body: body,
                    icon: 'images/icons/icon-192x192.png', // Make sure this path is correct
                    vibrate: [200, 100, 200]
                });
            });
        } else {
            // Standard Fallback
            new Notification(title, {
                body: body,
                icon: 'images/icons/icon-192x192.png'
            });
        }
    }
}

function showTopToast(msg, ms = 2200) {
    topToast.textContent = msg;
    topToast.style.display = 'block';
    clearTimeout(showTopToast._t);
    showTopToast._t = setTimeout(() => topToast.style.display = 'none', ms);
}

// Fetch student info
async function fetchStudentData(number) {
    if (!number) return null;
    try {
        const snap = await get(child(ref(db), `Students/${number}`));
        if (snap.exists()) return snap.val();
        return null;
    } catch (e) { console.error(e); return null; }
}

async function populateStudentInfo(number) {
    const data = await fetchStudentData(number);
    if (!data) {
        studentName.value = 'Not Found';
        strandSelect.innerHTML = `<option>Automatic</option>`;
        gradeSelect.innerHTML = `<option>Automatic</option>`;
        currentFullStrand = null;
        return;
    }

    studentName.value = data.name || data.fullName || 'Unknown';
    currentFullStrand = data.strand || null;

    const shortStrand = currentFullStrand
        ? currentFullStrand.replace(/\s*-\s.*$/, '').trim()
        : 'Automatic';

    strandSelect.innerHTML = '';
    const opt = document.createElement('option');
    opt.textContent = shortStrand;
    opt.value = shortStrand;
    if (currentFullStrand) opt.dataset.full = currentFullStrand;
    strandSelect.appendChild(opt);

    gradeSelect.innerHTML = `<option>${data.grade || 'Automatic'}</option>`;
}


// Sign in anonymously
signInAnonymously(auth).then(() => {

    studentNumber.addEventListener('input', () => {
        const v = studentNumber.value.trim();
        if (v.length === 11) {
            studentName.value = 'Searching...';
            populateStudentInfo(v);
        } else {
            studentName.value = '';
            strandSelect.innerHTML = `<option>Automatic</option>`;
            gradeSelect.innerHTML = `<option>Automatic</option>`;
            currentFullStrand = null;
        }
    });

    btnSubmit.addEventListener('click', async () => {
        const number = studentNumber.value.trim();
        if (number.length !== 11) {
            showTopToast('Please enter a valid 11-digit student number.');
            return;
        }

        const name = studentName.value || 'Unknown';
        const selectedOpt = strandSelect.options[strandSelect.selectedIndex];
        const selectedOptFull = selectedOpt && selectedOpt.dataset ? selectedOpt.dataset.full : undefined;
        const fullStrandToSave = currentFullStrand ?? selectedOptFull ?? strandSelect.value ?? 'Automatic';

        const grade = gradeSelect.value || 'Automatic';
        const now = Date.now();
        const dateISO = new Date(now).toISOString().split('T')[0];

        try {
            // 1) Create session under Students
            const sessionsRef = ref(db, `Students/${number}/sessions`);
            const newSessionRef = push(sessionsRef);
            const sessionData = { studentNumber: number, name, strand: fullStrandToSave, grade, loginTime: now, logoutTime: 0, date: dateISO };
            await set(newSessionRef, sessionData);

            // 2) Save SessionsByToken for finishScanActivity.html
            await set(ref(db, `SessionsByToken/${token}`), {
                studentNumber: number,
                name,
                sessionKey: newSessionRef.key,
                loginTime: now
            });

            // 3) Save locally
            localStorage.setItem('studentNum', number);
            localStorage.setItem('studentLogKey', newSessionRef.key);

            // --- TRIGGER NOTIFICATION HERE ---
            triggerNotification("Login Successful", `Welcome, ${name}! Do not forget to log out before leaving the library.`);

            showTopToast('Attendance logged!');
            setTimeout(() => {
                window.location.href = `finishScanActivity.html?token=${token}`;
            }, 800);

        } catch (e) {
            console.error('Error saving session', e);
            showTopToast('Error saving session.');
        }
    });

}).catch(err => showTopToast('Auth failed: ' + err.message));
