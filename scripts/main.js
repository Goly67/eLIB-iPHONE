import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";

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
const auth = getAuth(app);
const btnScan = document.getElementById('btnScanQR');
const btnNotif = document.getElementById('btnEnableNotif'); 

// Register Service Worker for PWA & Notifications
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('SW Registered', reg))
    .catch(err => console.error('SW Fail', err));
}

const topToast = document.getElementById('topToast');

function showTopToast(message) {
  topToast.textContent = message;
  topToast.style.display = "block";
  setTimeout(() => { topToast.style.display = "none"; }, 2400);
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    showTopToast("Notifications not supported");
    return false;
  }

  if (Notification.permission === 'denied') {
    showTopToast("⚠️ Notifications blocked. Please enable in browser settings.");
    return false;
  }

  if (Notification.permission === 'granted') {
    showTopToast("Notifications already active ✅");
    return true;
  }

  try {
    const perm = await Notification.requestPermission();

    if (perm === "granted") {
      showTopToast("Notifications enabled! ✅");
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'TEST_NOTIF' });
      } else {
        new Notification("Setup Complete", { body: "You will receive library reminders." });
      }
      return true;
    } else {
      showTopToast("Notifications blocked ❌");
      return false;
    }
  } catch (e) {
    console.warn("Notification permission error", e);
    showTopToast("Error enabling notifications");
    return false;
  }
}

async function requestCameraAccess() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showTopToast("Camera access not supported.");
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch (e) {
    console.warn("Camera permission error", e);
    showTopToast("Camera permission required.");
    return false;
  }
}

// ---------- iOS PWA Instructions (Perfectly Centered) ----------
function checkIOSPWA() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // Only show if on iOS AND NOT installed (browser tab)
  if (isIOS && !isStandalone) {

    const overlay = document.createElement('div');
    overlay.id = 'ios-install-overlay';

    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      /* CENTER VERTICALLY & HORIZONTALLY */
      justify-content: center;
      align-items: center;
      /* REMOVED PADDING HERE TO FIX SHIFT */
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      animation: fadeIn 0.4s ease-out;
    `;

    overlay.innerHTML = `
      <style>
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
          40% {transform: translateY(10px);}
          60% {transform: translateY(5px);}
        }
        @keyframes fadeIn {
          from {opacity: 0;}
          to {opacity: 1;}
        }
        .install-card {
          background: #1c1c1e;
          border: 1px solid #333;
          /* FIXED WIDTH LOGIC */
          width: calc(100% - 40px);
          max-width: 340px;
          margin: 0 20px; /* Ensures it pushes away from edges */
          
          padding: 30px 20px;
          border-radius: 24px;
          text-align: center;
          color: white;
          box-shadow: 0 20px 40px rgba(0,0,0,0.6);
          box-sizing: border-box;
        }
        .install-title {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 12px;
          color: #fff;
        }
        .install-text {
          font-size: 15px;
          line-height: 1.5;
          color: #aaa;
          margin-bottom: 25px;
        }
        .steps-container {
            display: flex;
            flex-direction: column;
            gap: 15px;
            align-items: center;
            width: 100%;
        }
        .step-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-size: 16px;
          font-weight: 500;
          width: 100%;
        }
        .ios-share-icon {
          width: 24px;
          height: 24px;
          filter: invert(1); 
        }
        .add-btn-graphic {
            background: #333;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 14px;
            color: #fff;
            border: 1px solid #555;
            display: inline-block;
            font-weight: 600;
        }
        .arrow-down {
          font-size: 32px;
          margin-top: 25px;
          animation: bounce 2s infinite;
          color: #0A84FF;
        }
        .dismiss-btn {
          margin-top: 20px;
          background: transparent;
          border: none;
          color: #666;
          font-size: 13px;
          text-decoration: underline;
          padding: 10px;
          cursor: pointer;
        }
      </style>

      <div class="install-card">
        <div class="install-title">Install App Required</div>
        <div class="install-text">To use the notifications, please add this app to your home screen.</div>
        
        <div class="steps-container">
            <!-- Step 1 -->
            <div class="step-row">
                <span>1. Tap Share</span>
                <img src="images/icons/share.png" class="ios-share-icon" alt="Share">
            </div>
            
            <!-- Step 2 -->
            <div class="step-row">
                <span>2. Select</span>
                <div class="add-btn-graphic">Add to Home Screen</div>
            </div>
        </div>

        <div class="arrow-down">⬇</div>
        
        <button class="dismiss-btn" id="dismissOverlay">I dont want notifications, close app</button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('dismissOverlay').onclick = () => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    };
  }
}

// ---------- Main Logic ----------

const studentNum = localStorage.getItem('studentNum');
const studentLogKey = localStorage.getItem('studentLogKey');
const loginTimestamp = parseInt(localStorage.getItem('loginTimestamp'), 10) || 0;
const now = Date.now();
const sessionValid = studentNum && studentLogKey && (now - loginTimestamp < 60 * 60 * 1000);

if (sessionValid) {
  window.location.href = "finishScanActivity.html";
} else {
  localStorage.removeItem('studentNum');
  localStorage.removeItem('studentLogKey');
  localStorage.removeItem('loginTimestamp');
}

signInAnonymously(auth)
  .then(async () => {
    showTopToast("Data successfully gathered.");
    checkIOSPWA(); 
  })
  .catch(() => showTopToast("No internet connection."));

if (btnScan) {
  btnScan.addEventListener('click', async () => {
    const ok = await requestCameraAccess();
    if (ok) {
      setTimeout(() => { window.location.href = "scan.html"; }, 150);
    }
  });
}

if (btnNotif && Notification.permission === 'granted') {
  btnNotif.style.display = 'none';
}

if (btnNotif) {
  btnNotif.addEventListener('click', async () => {
    console.log("Notification button clicked!"); 
    await requestNotificationPermission();

    if (Notification.permission === 'granted') {
      btnNotif.style.display = 'none';
    }
  });
}
