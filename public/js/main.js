const backdrop = document.querySelector(".backdrop");
const sideDrawer = document.querySelector(".mobile-nav");
const menuToggle = document.querySelector("#side-menu-toggle");

function backdropClickHandler() {
  if (backdrop) backdrop.style.display = "none";
  if (sideDrawer) sideDrawer.classList.remove("open");
}

function menuToggleClickHandler() {
  if (backdrop) backdrop.style.display = "block";
  if (sideDrawer) sideDrawer.classList.add("open");
}

if (backdrop) {
  backdrop.addEventListener("click", backdropClickHandler);
}
if (menuToggle) {
  menuToggle.addEventListener("click", menuToggleClickHandler);
}
