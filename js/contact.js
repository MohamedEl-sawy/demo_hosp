function openTab(tabName) {
  const tabs = document.querySelectorAll(".tab-content");
  const buttons = document.querySelectorAll(".tab-btn");

  tabs.forEach(tab => {
    tab.style.display = "none";
  });

  buttons.forEach(btn => {
    btn.classList.remove("active");
  });

  document.getElementById(tabName).style.display = "block";
  event.currentTarget.classList.add("active");
}

const inputs = document.querySelectorAll("input, textarea");

inputs.forEach(input => {
  input.addEventListener("input", () => {
    validateField(input);
  });
});

function validateField(input) {
  if (input.value.trim() === "") {
    input.style.border = "1px solid #ef4444";
  } else {
    input.style.border = "1px solid #5bb4b4";
  }

  // email validation
  if (input.type === "email") {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
    input.style.border = valid
      ? "1px solid #5bb4b4"
      : "1px solid #ef4444";
  }
}