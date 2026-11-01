const uname = document.getElementById("uname");
const psw = document.getElementById("psw");
const login = document.getElementById("login");

login.onclick = async function () {
  const username = uname.value.trim();
  const password = psw.value;

  if (!username || !password) {
    alert("Please enter your username and password.");
    return;
  }

  try {
    const response = await axios.post("http://localhost:3000/login", {
      username: username,
      password: password
    });

    if (response.data.user === true) {
      sessionStorage.setItem("username", username);

      if (Number(response.data.admin) === 1) {
        window.location.href = "front%20end/Teacher.html";
      } else {
        window.location.href = "front%20end/PATIENTS.html";
      }
    } else {
      alert(response.data.message || "Incorrect username or password.");
    }
  } catch (error) {
    console.error("Login error:", error);
    alert(error.response?.data?.message || "Login failed. Check that the server is running.");
  }
};
