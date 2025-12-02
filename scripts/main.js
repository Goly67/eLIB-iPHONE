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
const btnNotif = document.getElementById('btnEnableNotif'); // ADD THIS BUTTON TO HTML!

// Register Service Worker for PWA & Notifications
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('scripts/sw.js')
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

  // 1. Check if already denied
  if (Notification.permission === 'denied') {
    showTopToast("⚠️ Notifications blocked. Please enable in browser settings.");
    return false;
  }

  // 2. Check if already granted
  if (Notification.permission === 'granted') {
    showTopToast("Notifications already active ✅");
    return true;
  }

  try {
    // 3. Request permission
    const perm = await Notification.requestPermission();
    
    if (perm === "granted") {
      showTopToast("Notifications enabled! ✅");
      
      // Test notification
      if (navigator.serviceWorker.controller) {
         navigator.serviceWorker.controller.postMessage({ type: 'TEST_NOTIF' });
      } else {
         // Fallback if SW isn't ready yet
         new Notification("Setup Complete", { body: "You will receive library reminders." });
      }
      return true;
    } else {
      // User clicked "Block" or "X" just now
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

// ---------- iOS PWA Instructions (High Visibility) ----------
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
      background-color: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      padding-bottom: 40px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      animation: fadeIn 0.5s ease-out;
    `;

    overlay.innerHTML = `
      <style>
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
          40% {transform: translateY(-10px);}
          60% {transform: translateY(-5px);}
        }
        @keyframes fadeIn {
          from {opacity: 0;}
          to {opacity: 1;}
        }
        .install-card {
          background: #1c1c1e;
          border-top: 1px solid #333;
          width: 100%;
          max-width: 400px;
          padding: 30px 20px;
          border-radius: 20px 20px 0 0;
          text-align: center;
          color: white;
          box-shadow: 0 -5px 20px rgba(0,0,0,0.5);
        }
        .install-title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 10px;
          color: #fff;
        }
        .install-text {
          font-size: 15px;
          line-height: 1.5;
          color: #aaa;
          margin-bottom: 20px;
        }
        .step-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 8px;
          font-size: 16px;
          font-weight: 500;
        }
        /* UPDATED CLASS: No filter needed if your icon is already white/colored appropriately, 
           but 'filter: invert(1)' makes black icons white if needed. */
        .ios-share-icon {
          width: 24px;
          height: 24px;
          /* filter: invert(1); <--- Remove this line if your share.png is already white/light */
        }
        .arrow-down {
          font-size: 30px;
          margin-top: 15px;
          animation: bounce 2s infinite;
          color: #007AFF;
        }
        .dismiss-btn {
          margin-top: 20px;
          background: transparent;
          border: 1px solid #444;
          color: #888;
          padding: 8px 20px;
          border-radius: 20px;
          font-size: 12px;
        }
      </style>

      <div class="install-card">
        <div class="install-title">Install App Required</div>
        <div class="install-text">To use the QR Scanner and receive notifications, you must add this app to your home screen.</div>
        
        <div class="step-row">
          <span>1. Tap</span>
          <!-- UPDATED IMAGE SOURCE -->
          <img src="images/icons/share.png" class="ios-share-icon" alt="Share">
          <span>below</span>
        </div>
        
        <div class="step-row">
          <span>2. Select</span>
          <span style="background:#333; padding:2px 8px; border-radius:6px;">Add to Home Screen</span>
        </div>

        <div class="arrow-down">⬇</div>
        
        <button class="dismiss-btn" id="dismissOverlay">Close (App won't work correctly)</button>
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

// Check active session
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

// Auth & Init
signInAnonymously(auth)
  .then(async () => {
    showTopToast("Data successfully gathered.");
    checkIOSPWA(); // Check if we need to show iOS instructions
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

// Hide button on load if already granted
if (btnNotif && Notification.permission === 'granted') {
    btnNotif.style.display = 'none';
}

// IMPORTANT: You need a separate button for this on iOS
// You cannot ask for notifications automatically on page load in iOS PWA
if (btnNotif) {
    btnNotif.addEventListener('click', async () => {
        console.log("Notification button clicked!"); // Debug log
        await requestNotificationPermission();
        
        // If granted, hide button immediately for better UX
        if (Notification.permission === 'granted') {
            btnNotif.style.display = 'none';
        }
    });
}
