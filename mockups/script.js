const activeGroups = document.querySelectorAll("[data-active-group]");

activeGroups.forEach((group) => {
  group.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target || target.classList.contains("disabled")) return;

    group.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
    target.classList.add("active");
  });
});

const roomButtons = document.querySelectorAll("[data-room-select]");
const selectedRoomLabels = document.querySelectorAll("[data-selected-room]");

roomButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const room = button.getAttribute("data-room-select");
    roomButtons.forEach((item) => item.classList.remove("active", "is-selected"));
    button.classList.add(button.classList.contains("mobile-room") ? "active" : "is-selected");
    selectedRoomLabels.forEach((label) => {
      label.textContent = room || "강의실 1";
    });
  });
});

const timeSlots = document.querySelectorAll("[data-time-slot]");
const selectedTimeLabels = document.querySelectorAll("[data-selected-time]");

timeSlots.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.classList.contains("disabled")) return;
    const group = button.closest("[data-time-group]") || document;
    group.querySelectorAll("[data-time-slot]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    selectedTimeLabels.forEach((label) => {
      label.textContent = button.getAttribute("data-time-slot") || button.textContent.trim();
    });
  });
});
