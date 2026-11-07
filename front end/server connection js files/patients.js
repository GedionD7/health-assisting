
const patientList = document.getElementById("patientList");
const logoutButton = document.getElementById("signout");

const username = sessionStorage.getItem("username");

// Load actual patient records from PostgreSQL.
async function loadPatients() {
  patientList.innerHTML =
    '<p class="empty-state">Loading patients...</p>';

  try {
    const response = await axios.get("/getPatients");
    const patients = response.data;

    patientList.innerHTML = "";

    if (!Array.isArray(patients) || patients.length === 0) {
      patientList.innerHTML = `
        <div class="empty-state">
          <h2>No patients found</h2>
          <p>
            There are currently no patient records in the database.
            Ask your administrator to add patients.
          </p>
        </div>
      `;
      return;
    }

    patients.forEach((patient) => {
      if (
        patient.patient_id == null ||
        !patient.first_name ||
        !patient.last_name
      ) {
        return;
      }

      const link = document.createElement("a");

      link.className = "patient-card";
      link.href = "ADL.html";
      link.textContent =
        `${patient.first_name} ${patient.last_name}`;

      link.addEventListener("click", () => {
        sessionStorage.setItem(
          "patientval",
          String(patient.patient_id)
        );
      });

      patientList.appendChild(link);
    });

    if (patientList.children.length === 0) {
      patientList.innerHTML = `
        <div class="empty-state">
          <h2>No valid patient records</h2>
          <p>Please check the patient records in the database.</p>
        </div>
      `;
    }
  } catch (error) {
    console.error("Could not load patients:", error);

    patientList.innerHTML = `
      <div class="empty-state error-message">
        <h2>Unable to load patients</h2>
        <p>Please refresh the page or contact your administrator.</p>
      </div>
    `;
  }
}

// Sign out.
if (logoutButton) {
  logoutButton.addEventListener("click", async (event) => {
    event.preventDefault();

    try {
      if (username) {
        await axios.post("/logout", { username });
      }
    } catch (error) {
      console.error("Sign-out request failed:", error);
    } finally {
      sessionStorage.removeItem("username");
      sessionStorage.removeItem("patientval");
      window.location.href = "../index.html";
    }
  });
}

loadPatients();
