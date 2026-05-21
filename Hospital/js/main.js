const links = document.querySelectorAll(".sb-link");

links.forEach(link => {
    if (link.href === window.location.href) {
        link.classList.add("active");
    }
});