// STS Smart School - Super Admin Tenant Management Module
// Star Tech Solutions Limited
import { db, auth } from "./firebase-config.js";
import { checkAuthState } from "./auth.js";
import { 
  collection, getDocs, doc, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

checkAuthState();

const saSchoolsTableBody = document.getElementById("saSchoolsTableBody");
const saSearchSchool = document.getElementById("saSearchSchool");

async function loadAllSchools(filterQuery = "") {
  if (!saSchoolsTableBody) return;
  saSchoolsTableBody.innerHTML = "<tr><td colspan='6'>Loading system records...</td></tr>";

  const snap = await getDocs(collection(db, "schools"));
  saSchoolsTableBody.innerHTML = "";

  let totalCount = 0;
  let pendingCount = 0;
  let activeCount = 0;

  snap.forEach(docSnap => {
    const school = docSnap.data();
    totalCount++;
    if (school.status === "Pending") pendingCount++;
    if (school.status === "Approved") activeCount++;

    if (filterQuery && !school.schoolName.toLowerCase().includes(filterQuery.toLowerCase()) && !school.district.toLowerCase().includes(filterQuery.toLowerCase())) {
      return;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${school.schoolName}</strong></td>
      <td>${school.schoolType || 'N/A'}</td>
      <td>${school.district}, ${school.province}</td>
      <td>${school.email}</td>
      <td><span class="user-badge">${school.status}</span></td>
      <td>
        ${school.status === 'Pending' ? `<button class="btn btn-sm btn-primary approve-btn" data-id="${docSnap.id}">Approve</button>` : ''}
        ${school.status === 'Approved' ? `<button class="btn btn-sm btn-danger suspend-btn" data-id="${docSnap.id}">Suspend</button>` : ''}
        ${school.status === 'Suspended' ? `<button class="btn btn-sm btn-secondary approve-btn" data-id="${docSnap.id}">Activate</button>` : ''}
        <button class="btn btn-sm btn-danger delete-school-btn" data-id="${docSnap.id}">Delete</button>
        <button class="btn btn-sm reset-pwd-btn" data-email="${school.email}">Reset Password</button>
      </td>
    `;
    saSchoolsTableBody.appendChild(tr);
  });

  // Update Metrics Header
  document.getElementById("saTotalSchools").textContent = totalCount;
  document.getElementById("saPendingSchools").textContent = pendingCount;
  document.getElementById("saActiveSchools").textContent = activeCount;

  // Bind Actions
  document.querySelectorAll(".approve-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      await updateDoc(doc(db, "schools", e.target.dataset.id), { status: "Approved" });
      loadAllSchools();
    });
  });

  document.querySelectorAll(".suspend-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      await updateDoc(doc(db, "schools", e.target.dataset.id), { status: "Suspended" });
      loadAllSchools();
    });
  });

  document.querySelectorAll(".delete-school-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if (confirm("Permanently delete school tenant record?")) {
        await deleteDoc(doc(db, "schools", e.target.dataset.id));
        loadAllSchools();
      }
    });
  });

  document.querySelectorAll(".reset-pwd-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const email = e.target.dataset.email;
      try {
        await sendPasswordResetEmail(auth, email);
        alert("Password reset email sent to " + email);
      } catch (err) {
        alert("Failed to send reset email: " + err.message);
      }
    });
  });
}

if (saSearchSchool) {
  saSearchSchool.addEventListener("input", (e) => loadAllSchools(e.target.value));
}

loadAllSchools();