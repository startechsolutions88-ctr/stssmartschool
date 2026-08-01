// STS Smart School - Authentication & Logout Handler
// Star Tech Solutions Limited

import { auth } from "./firebase-config.js";
import { 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ------------------------------------------------------------------
// 1. AUTH STATE CHECK & ROLE DISPLAY
// ------------------------------------------------------------------
onAuthStateChanged(auth, (user) => {
  const currentPage = window.location.pathname.split("/").pop();

  // Exclude login/index page from redirect loop
  if (!user && currentPage !== "index.html" && currentPage !== "") {
    window.location.href = "index.html";
    return;
  }

  if (user) {
    const userRole = localStorage.getItem("userRole") || "USER";
    const userName = localStorage.getItem("userName") || user.email;

    // Display user metadata in top navigation bar
    const roleBadge = document.getElementById("userRoleDisplay");
    const nameDisplay = document.getElementById("userNameDisplay");

    if (roleBadge) roleBadge.textContent = userRole.toUpperCase();
    if (nameDisplay) nameDisplay.textContent = userName;
  }
});

// ------------------------------------------------------------------
// 2. LOGOUT FUNCTIONALITY
// ------------------------------------------------------------------
export async function handleLogout() {
  try {
    // 1. Sign out from Firebase Authentication
    await signOut(auth);

    // 2. Clear stored session and school tenancy context
    localStorage.removeItem("schoolId");
    localStorage.removeItem("schoolName");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    sessionStorage.clear();

    // 3. Redirect back to login page
    window.location.href = "index.html";
  } catch (error) {
    console.error("Logout Error:", error);
    alert("Failed to log out: " + error.message);
  }
}

// Attach logout click listener to all pages automatically
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const confirmLogout = confirm("Are you sure you want to log out of STS Smart School?");
      if (confirmLogout) {
        handleLogout();
      }
    });
  }
});