// STS Smart School - SMS Engine & Credit Manager
// Star Tech Solutions Limited
import { db, auth } from "./firebase-config.js";
import { 
  collection, addDoc, getDocs, doc, setDoc, getDoc, updateDoc, query, where, increment 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const currentSchoolId = localStorage.getItem("schoolId");
const currentSchoolName = localStorage.getItem("schoolName") || "STS Smart School";

// ------------------------------------------------------------------
// 1. SMS GATEWAY API DISPATCH (INCLUDES CREDENTIAL BINDING)
// ------------------------------------------------------------------
export async function sendSmsViaGateway(phoneNumber, messageText) {
  // Retrieve custom API settings from Firestore for active school
  const settingsDoc = await getDoc(doc(db, "smsSettings", currentSchoolId));
  
  // Default/Fallback Parameters
  let apiKey = "";
  let apiUserToken = "";
  let senderId = currentSchoolName.substring(0, 11);
  let provider = "AfricasTalking"; // Options: AfricasTalking, Twilio, SMSZambia
  let isEnabled = true;

  if (settingsDoc.exists()) {
    const config = settingsDoc.data();
    isEnabled = config.enabled;
    apiKey = config.apiKey || "";
    apiUserToken = config.apiUserToken || "";
    senderId = config.senderName || senderId;
    provider = config.provider || provider;
  }

  if (!isEnabled) {
    throw new Error("SMS notifications are currently disabled in school settings.");
  }

  // ================================================================
  // SMS API PROVIDER CONNECTION LOGIC
  // Replace the fetch block below with your live API endpoint as needed.
  // ================================================================
  
  /*
  // EXAMPLE: Local Zambian API / Africa's Talking Endpoint Integration
  const apiEndpoint = provider === "Twilio" 
    ? "https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json"
    : "https://api.africastalking.com/version1/messaging";

  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "apiKey": apiKey
    },
    body: new URLSearchParams({
      "username": apiUserToken,
      "to": phoneNumber,
      "message": messageText,
      "from": senderId
    })
  });

  if (!response.ok) {
    throw new Error(`Gateway Error (${response.status}): ${await response.text()}`);
  }
  */

  // Simulated live execution log
  console.log(`[SMS Gateway Dispatch] Provider: ${provider} | To: ${phoneNumber} | Sender: ${senderId} | Msg: ${messageText}`);
  return { success: true, status: "Sent" };
}

// ------------------------------------------------------------------
// 2. SMS CREDIT SYSTEM FUNCTIONS
// ------------------------------------------------------------------
export async function getSmsBalance() {
  if (!currentSchoolId) return 0;
  const schoolDoc = await getDoc(doc(db, "schools", currentSchoolId));
  if (schoolDoc.exists()) {
    return schoolDoc.data().smsBalance || 0;
  }
  return 0;
}

export async function deductSmsCredits(amount) {
  if (!currentSchoolId) return false;
  const schoolRef = doc(db, "schools", currentSchoolId);
  await updateDoc(schoolRef, {
    smsBalance: increment(-amount)
  });
  return true;
}

export async function addSmsCredits(schoolId, amount) {
  const schoolRef = doc(db, "schools", schoolId);
  await updateDoc(schoolRef, {
    smsBalance: increment(amount)
  });
}

// ------------------------------------------------------------------
// 3. EXACT FORMATTER & SPLITTER FOR RURAL SMS
// ------------------------------------------------------------------
export function formatStudentSms(schoolName, studentName, term, subjectScores, avg, position, totalStudents) {
  let subjectText = "";
  for (const [sub, score] of Object.entries(subjectScores)) {
    subjectText += `${sub}:${score}\n`;
  }

  const rawText = `${schoolName}\nStudent: ${studentName}\n${term} Results:\n${subjectText}Average:${avg}%\nPosition:${position}/${totalStudents}`;
  
  // Split into multiple SMS segments if over 160 chars
  const segments = [];
  if (rawText.length > 160) {
    for (let i = 0; i < rawText.length; i += 150) {
      segments.push(rawText.substring(i, i + 150));
    }
  } else {
    segments.push(rawText);
  }

  return segments;
}

// ------------------------------------------------------------------
// 4. PUBLISH RESULTS VIA SMS ENGINE
// ------------------------------------------------------------------
export async function publishClassResults(className, term, progressCallback) {
  if (!currentSchoolId) throw new Error("No active school session.");

  // Check Current Balance First
  const balance = await getSmsBalance();
  
  // Retrieve students in class
  const qStudents = query(
    collection(db, "students"), 
    where("schoolId", "==", currentSchoolId),
    where("studentClass", "==", className)
  );
  const studentsSnap = await getDocs(qStudents);
  if (studentsSnap.empty) throw new Error("No students registered in this class.");

  const totalStudents = studentsSnap.size;
  const studentsList = [];
  studentsSnap.forEach(d => studentsList.push({ id: d.id, ...d.data() }));

  // Check estimated credits required
  if (balance < totalStudents) {
    throw new Error(`Insufficient SMS Balance. You need at least ${totalStudents} credits for this class, but only have ${balance} remaining.`);
  }

  // Get Class Results
  const qResults = query(
    collection(db, "results"),
    where("schoolId", "==", currentSchoolId),
    where("className", "==", className),
    where("term", "==", term)
  );
  const resultsSnap = await getDocs(qResults);

  // Map scores per student
  const studentResults = {};
  resultsSnap.forEach(docSnap => {
    const res = docSnap.data();
    if (!studentResults[res.studentId]) {
      studentResults[res.studentId] = { scores: {}, total: 0, count: 0 };
    }
    studentResults[res.studentId].scores[res.subjectName] = res.mark;
    studentResults[res.studentId].total += res.mark;
    studentResults[res.studentId].count += 1;
  });

  // Calculate Averages and Ranks
  const rankedStudents = studentsList.map(s => {
    const res = studentResults[s.studentId] || { scores: {}, total: 0, count: 0 };
    const avg = res.count > 0 ? (res.total / res.count).toFixed(1) : 0;
    return { ...s, scores: res.scores, avg: parseFloat(avg) };
  });

  rankedStudents.sort((a, b) => b.avg - a.avg);

  const currentUser = auth.currentUser ? auth.currentUser.email : "Head Teacher";
  let processed = 0;

  // Process & Send Batch
  for (let i = 0; i < rankedStudents.length; i++) {
    const student = rankedStudents[i];
    const position = `${i + 1}/${totalStudents}`;
    const smsParts = formatStudentSms(currentSchoolName, student.fullName, term, student.scores, student.avg, position, totalStudents);

    for (let pIndex = 0; pIndex < smsParts.length; pIndex++) {
      const messageBody = smsParts.length > 1 ? `(${pIndex + 1}/${smsParts.length}) ${smsParts[pIndex]}` : smsParts[pIndex];
      let status = "Sent";

      try {
        await sendSmsViaGateway(student.parentPhone, messageBody);
        await deductSmsCredits(1); // Deduct 1 credit per sent segment
      } catch (err) {
        status = "Failed";
      }

      // Record entry in Firestore 'smsLogs' collection
      await addDoc(collection(db, "smsLogs"), {
        schoolId: currentSchoolId,
        studentId: student.studentId,
        studentName: student.fullName,
        parentPhone: student.parentPhone || "N/A",
        message: messageBody,
        status: status,
        sentDate: new Date(),
        sentBy: currentUser
      });
    }

    processed++;
    if (progressCallback) progressCallback(processed, totalStudents);
  }
}

// ------------------------------------------------------------------
// 5. PAGE LOGIC: SMS SETTINGS
// ------------------------------------------------------------------
if (window.location.pathname.endsWith("sms-settings.html")) {
  const form = document.getElementById("smsSettingsForm");
  const testBtn = document.getElementById("testSmsBtn");

  async function loadSettings() {
    if (!currentSchoolId) return;
    const settingsDoc = await getDoc(doc(db, "smsSettings", currentSchoolId));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      document.getElementById("smsEnabled").checked = data.enabled;
      document.getElementById("senderName").value = data.senderName || "";
      document.getElementById("provider").value = data.provider || "AfricasTalking";
      document.getElementById("apiKey").value = data.apiKey || "";
      document.getElementById("apiUserToken").value = data.apiUserToken || "";
    }
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await setDoc(doc(db, "smsSettings", currentSchoolId), {
        schoolId: currentSchoolId,
        enabled: document.getElementById("smsEnabled").checked,
        senderName: document.getElementById("senderName").value,
        provider: document.getElementById("provider").value,
        apiKey: document.getElementById("apiKey").value,
        apiUserToken: document.getElementById("apiUserToken").value,
        updatedAt: new Date()
      });
      alert("SMS Gateway Configuration Saved!");
    });
  }

  if (testBtn) {
    testBtn.addEventListener("click", async () => {
      const testPhone = document.getElementById("testPhone").value;
      if (!testPhone) return alert("Please enter a valid phone number.");
      try {
        await sendSmsViaGateway(testPhone, `[${currentSchoolName}] Test notification successful.`);
        alert("Test SMS dispatched successfully!");
      } catch (err) {
        alert("Test dispatch failed: " + err.message);
      }
    });
  }

  loadSettings();
}

// ------------------------------------------------------------------
// 6. PAGE LOGIC: SMS HISTORY & REPORTS
// ------------------------------------------------------------------
if (window.location.pathname.endsWith("sms-history.html")) {
  const tableBody = document.getElementById("smsLogsTableBody");
  const searchInput = document.getElementById("searchSmsLog");

  async function loadLogs(filter = "") {
    if (!tableBody || !currentSchoolId) return;
    tableBody.innerHTML = "<tr><td colspan='7'>Loading delivery reports...</td></tr>";

    const q = query(collection(db, "smsLogs"), where("schoolId", "==", currentSchoolId));
    const snap = await getDocs(q);
    tableBody.innerHTML = "";

    let totalSent = 0;
    let totalSuccess = 0;
    let totalFailed = 0;

    snap.forEach(docSnap => {
      const log = docSnap.data();
      totalSent++;
      if (log.status === "Sent") totalSuccess++;
      if (log.status === "Failed") totalFailed++;

      if (filter && !log.studentName.toLowerCase().includes(filter.toLowerCase()) && !log.parentPhone.includes(filter)) {
        return;
      }

      const dateStr = log.sentDate ? new Date(log.sentDate.toDate ? log.sentDate.toDate() : log.sentDate).toLocaleString() : "N/A";
      const statusBadge = log.status === "Sent" ? "background:#d4edda; color:#155724;" : "background:#f8d7da; color:#721c24;";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${log.studentName} (${log.studentId})</td>
        <td>${log.parentPhone}</td>
        <td style="font-size: 0.8rem;">${log.message}</td>
        <td><span class="user-badge" style="${statusBadge}">${log.status}</span></td>
        <td>${dateStr}</td>
        <td>${log.sentBy}</td>
      `;
      tableBody.appendChild(tr);
    });

    // Update Summary Cards
    if (document.getElementById("statTotalSent")) document.getElementById("statTotalSent").textContent = totalSent;
    if (document.getElementById("statSuccess")) document.getElementById("statSuccess").textContent = totalSuccess;
    if (document.getElementById("statFailed")) document.getElementById("statFailed").textContent = totalFailed;
  }

  if (searchInput) searchInput.addEventListener("input", (e) => loadLogs(e.target.value));
  loadLogs();
}

// ------------------------------------------------------------------
// 7. PAGE LOGIC: SMS BALANCE DASHBOARD
// ------------------------------------------------------------------
if (window.location.pathname.endsWith("sms-balance.html")) {
  async function renderBalancePage() {
    const balance = await getSmsBalance();
    document.getElementById("currentSmsBalance").textContent = balance;
  }

  const topupBtn = document.getElementById("requestTopupBtn");
  if (topupBtn) {
    topupBtn.addEventListener("click", () => {
      alert("Top-up request sent to Star Tech Solutions Limited. Contact support at +260972570250 for instant top-ups.");
    });
  }

  renderBalancePage();
}