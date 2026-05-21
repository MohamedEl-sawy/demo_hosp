import { db } from "./firebase.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const signupBtn = document.getElementById("signupBtn");

// inputs
const inputs = {
  hospitalName: document.getElementById("hospitalName"),
  location: document.getElementById("location"),
  governorate: document.getElementById("governorate"),
  license: document.getElementById("license"),
  specialties: document.getElementById("specialties"),
  managerName: document.getElementById("managerName"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
};

// strength UI
const strengthFill = document.getElementById("strengthFill");
const strengthText = document.getElementById("strengthText");

// ---------------- REAL TIME VALIDATION ----------------

Object.keys(inputs).forEach((key) => {
  inputs[key].addEventListener("input", () => validateField(key));
});

function validateField(key) {
  const value = inputs[key].value.trim();
  const wrapper = inputs[key].parentElement;

  if (!value) {
    setError(wrapper, `${key} is required`);
    return false;
  }

  // email check
  if (key === "email" && !value.includes("@")) {
    setError(wrapper, "Invalid email format");
    return false;
  }

  // password check
  if (key === "password" && value.length < 6) {
    setError(wrapper, "Password too short");
    return false;
  }

  setSuccess(wrapper);
  return true;
}

// ---------------- PASSWORD STRENGTH ----------------

inputs.password.addEventListener("input", (e) => {
  const val = e.target.value;

  let strength = 0;

  if (val.length >= 6) strength += 25;
  if (val.length >= 10) strength += 25;
  if (/[A-Z]/.test(val)) strength += 25;
  if (/[0-9]/.test(val)) strength += 25;

  strengthFill.style.width = strength + "%";

  if (strength <= 25) {
    strengthFill.style.background = "red";
    strengthText.innerText = "Weak 🔴";
  } else if (strength <= 50) {
    strengthFill.style.background = "orange";
    strengthText.innerText = "Medium 🟠";
  } else if (strength <= 75) {
    strengthFill.style.background = "#facc15";
    strengthText.innerText = "Good 🟡";
  } else {
    strengthFill.style.background = "#22c55e";
    strengthText.innerText = "Strong 🟢";
  }
});

// ---------------- SUBMIT ----------------

signupBtn.addEventListener("click", signup);

async function signup(e) {
  e.preventDefault();

  let valid = true;

  Object.keys(inputs).forEach((key) => {
    if (!validateField(key)) valid = false;
  });

  if (!valid) {
    showToast("Please fix errors", "error");
    return;
  }

  try {
    const hospitalsRef = ref(db, "hospitals");
    const snapshot = await get(hospitalsRef);

    let next = 1;
    if (snapshot.exists()) {
      next = Object.keys(snapshot.val()).length + 1;
    }

    const id = "hospit" + String(next).padStart(3, "0");

    await set(ref(db, "hospitals/" + id), {
      id,
      name: inputs.hospitalName.value,
      location: inputs.location.value,
      governorate: inputs.governorate.value,
      license: inputs.license.value,
      specialties: inputs.specialties.value,
      managerName: inputs.managerName.value,
      email: inputs.email.value,
      password: inputs.password.value,
      createdAt: Date.now()
    });

      showToast("Account created 🎉", "success");
      document.querySelector(".login-container").classList.add("fade-out");

        setTimeout(() => {
        window.location.href = "login.html";
        }, 500);

  } catch (err) {
    console.log(err);
    showToast("Error occurred", "error");
  }
}

// ---------------- UI HELPERS ----------------

function setError(wrapper, msg) {
  wrapper.classList.add("error");
  wrapper.classList.remove("success");
  showToast(msg, "error");
}

function setSuccess(wrapper) {
  wrapper.classList.add("success");
  wrapper.classList.remove("error");
}

function showToast(msg, type) {
  const toast = document.querySelector(".toast");
  toast.innerText = msg;
  toast.className = `toast show ${type}`;

  setTimeout(() => {
    toast.className = "toast";
  }, 2500);
}