import { publishClassResults } from "./sms.js";

// Execute inside the results.html route handler:
if (window.location.pathname.endsWith("results.html")) {
  const publishSmsBtn = document.getElementById("publishSmsBtn");
  const userRole = localStorage.getItem("userRole");

  // Show "Publish Results" button ONLY to Administrator / Head Teacher
  if (publishSmsBtn && (userRole === "admin" || userRole === "head_teacher")) {
    publishSmsBtn.classList.remove("hidden");
    
    publishSmsBtn.addEventListener("click", async () => {
      const selectedClass = document.getElementById("filterClass").value;
      const selectedTerm = document.getElementById("filterTerm").value;
      const statusDiv = document.getElementById("publishStatus");

      const confirmDispatch = confirm(`Are you sure you want to publish ${selectedTerm} results via SMS to all parents in ${selectedClass}? This will deduct SMS credits from your school balance.`);

      if (confirmDispatch) {
        try {
          publishSmsBtn.disabled = true;
          statusDiv.classList.remove("hidden");
          statusDiv.textContent = "Verifying credit balance and preparing batch dispatch...";

          await publishClassResults(selectedClass, selectedTerm, (processed, total) => {
            statusDiv.textContent = `Dispatching parent notifications... (${processed}/${total} parents completed)`;
          });

          statusDiv.textContent = "Class results published successfully via SMS!";
          alert("All parents have been notified.");
        } catch (err) {
          alert("Publish failed: " + err.message);
          statusDiv.textContent = "Publish error: " + err.message;
        } finally {
          publishSmsBtn.disabled = false;
        }
      }
    });
  }
}