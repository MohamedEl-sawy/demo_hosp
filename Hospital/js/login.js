import { db } from "./firebase.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const loginBtn = document.getElementById("loginBtn");
const errorMsg = document.getElementById("errorMsg");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const toast = document.getElementById("toast");

// 👁️ show/hide password
togglePassword.addEventListener("click", () => {
  const type = passwordInput.getAttribute("type");

  if (type === "password") {
    passwordInput.setAttribute("type", "text");
    togglePassword.classList.remove("fa-eye");
    togglePassword.classList.add("fa-eye-slash");
  } else {
    passwordInput.setAttribute("type", "password");
    togglePassword.classList.remove("fa-eye-slash");
    togglePassword.classList.add("fa-eye");
  }
});

// 🔘 login click
loginBtn.addEventListener("click", login);

// ⌨️ enter  
document.addEventListener("keypress", function (e) {
  if (e.key === "Enter") login();
});

async function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  resetMessage();


  if (!email || !password) {
    return showError("Please enter email and password");
  }

  setLoading(true);

  // 🔥 1. CHECK ADMIN FIRST
  try
  {
    const adminSnapshot = await get(ref(db, "AdminSafeHeart"));
    let adminFound = null;

    if (adminSnapshot.exists()) {
      const admins = adminSnapshot.val();

      for (let adminId in admins) {
        if (admins[adminId].email === email) {
          adminFound = admins[adminId];
          break;
        }
      }
    }
    // ✅ check admin login
    if (adminFound) {
      if (adminFound.password === password) {
        localStorage.setItem("token", "admin");
        localStorage.setItem("role", "admin");
       
        
        handleSuccess("admin");


        return;
      }
    }

    // 🔥 2. CHECK HOSPITALS
    const snapshot = await get(ref(db, "hospitals"));

    if (!snapshot.exists()) {
      setLoading(false);
      return showError("No users found");
    }

    const users = snapshot.val();
    let foundUser = null;

    for (let userId in users) {
      if (users[userId].email === email) {
        foundUser = { id: userId, ...users[userId] };
        break;
      }
    }

    if (!foundUser) {
      setLoading(false);
      return showError("Email not registered");
    }

    if (foundUser.password !== password) {
      setLoading(false);
      return showError("Wrong password");
    }

    // ✅ hospital login
    localStorage.setItem("token", foundUser.id);
    localStorage.setItem("role", "hospital");

    handleSuccess("hospital");

  } catch (error) {
    console.error(error);
    showError("Something went wrong");
  }

  setLoading(false);
}

// ---------------- UI ----------------

function showError(msg) {
  showToast(msg, "error");
}

function showSuccess(msg) {
  showToast(msg, "success");
}

function resetMessage() {
  errorMsg.classList.remove("show");
  errorMsg.innerText = "";
}

function setLoading(state) {
  if (state) {
    loginBtn.innerText = "Signing in...";
    loginBtn.disabled = true;
    loginBtn.style.opacity = "0.7";
  } else {
    loginBtn.innerText = "Sign In";
    loginBtn.disabled = false;
    loginBtn.style.opacity = "1";
  }
}
function showToast(message, type = "error") {
  toast.innerText = message;
  toast.className = "toast show " + type;

  setTimeout(() => {
    toast.className = "toast";
  }, 2500);
}

function handleSuccess(role) {

  if (role === "admin") {
    showSuccess("Welcome Admin");
  } else {
    showSuccess("Login successful");
  }

  setTimeout(() => {
    if (role === "admin") {
      window.location.href = "../SafeHeartAdmin/index.html";
    } else {
      window.location.href = "../html/Hospital_Dashboard.html";
    }
  }, 1200); // 👈 زودنا الوقت
}

function loginSuccess(id) {
    localStorage.setItem("token", id);
}