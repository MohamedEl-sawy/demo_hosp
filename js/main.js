const navbar = `
<nav class="navbar">
    <div class="logo">
        <i class="fa-solid fa-heart-pulse"></i> Safe Heart
    </div>

    <ul class="nav-links" id="navLinks">
        <li><a href="./HTML/home.html">Home</a></li>
        <li><a href="./HTML/about.html">About</a></li>
        <li><a href="./HTML/faq.html">FAQ</a></li>
        <li><a href="./HTML/contact.html">Contact</a></li>
    </ul>

    <button class="btn-download">Download App</button>

    <div class="menu-toggle" id="menuToggle">
        <i class="fas fa-bars"></i>
    </div>
</nav>
`;


const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
const overlay = document.getElementById("overlay");

function openMenu() {
    navLinks.classList.add("active");
    overlay.classList.add("active");
}

function closeMenu() {
    navLinks.classList.remove("active");
    overlay.classList.remove("active");
}

menuToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    navLinks.classList.contains("active") ? closeMenu() : openMenu();
});

// close لما تدوس بره
overlay.addEventListener("click", closeMenu);

// close لما تدوس على لينك
document.querySelectorAll(".nav-links a").forEach(link => {
    link.addEventListener("click", closeMenu);
});


const currentPage = window.location.pathname.split("/").pop();

document.querySelectorAll(".nav-links a").forEach(link => {
    if (link.getAttribute("href").includes(currentPage)) {
        link.classList.add("active");
    }
});