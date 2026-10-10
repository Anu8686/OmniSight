// Minimal behaviour for the demo page: keep the year current and block real form submission.
document.getElementById("year").textContent = new Date().getFullYear();
document.querySelector(".signup-form").addEventListener("submit", function (e) { e.preventDefault(); });
