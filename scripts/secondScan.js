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

// QR token from scan.html
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

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
    })();  // COMMENT EVERYTHING HERE

if (!token) {
    alert('Unauthorized access. Please scan QR code first.');
    window.location.href = 'scan.html';
} else {
    sessionStorage.setItem('qrSessionToken', token); // <-- save token
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
        return;
    }
    studentName.value = data.name || data.fullName || 'Unknown';
    strandSelect.innerHTML = `<option>${data.strand || 'Automatic'}</option>`;
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
        }
    });

    btnSubmit.addEventListener('click', async () => {
        const number = studentNumber.value.trim();
        if (number.length !== 11) {
            showTopToast('Please enter a valid 11-digit student number.');
            return;
        }

        const name = studentName.value || 'Unknown';
        const strand = strandSelect.value || 'Automatic';
        const grade = gradeSelect.value || 'Automatic';
        const now = Date.now();
        const dateISO = new Date(now).toISOString().split('T')[0];

        try {
            // 1) Create session under Students
            const sessionsRef = ref(db, `Students/${number}/sessions`);
            const newSessionRef = push(sessionsRef);
            const sessionData = { studentNumber: number, name, strand, grade, loginTime: now, logoutTime: 0, date: dateISO };
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

            showTopToast('Attendance logged! Redirecting...');
            setTimeout(() => {
                window.location.href = `finishScanActivity.html?token=${token}`;
            }, 800);

        } catch (e) {
            console.error('Error saving session', e);
            showTopToast('Error saving session.');
        }
    });

}).catch(err => showTopToast('Auth failed: ' + err.message));