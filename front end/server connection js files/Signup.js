const username = document.getElementById("username");
const password = document.getElementById("password");
const password2 = document.getElementById("password2");
const firstName = document.getElementById("firstName");
const lastName = document.getElementById("lastName");
const submit = document.getElementById("submit");
const student = document.getElementById("isntTeacher");
const teacher = document.getElementById("isTeacher");

submit.onclick = async function (event) {
  event.preventDefault();

  const usernameValue = username.value.trim();
  const passwordValue = password.value;
  const firstNameValue = firstName.value.trim();
  const lastNameValue = lastName.value.trim();

  let isAdmin;

  if (student.checked) {
    isAdmin = 0;
  } else if (teacher.checked) {
    isAdmin = 1;
  } else {
    isAdmin = null;
  }

  if (
    !usernameValue ||
    !passwordValue ||
    !password2.value ||
    !firstNameValue ||
    !lastNameValue ||
    isAdmin === null
  ) {
    window.alert("Please fill out all fields and choose student or teacher.");
    return;
  }

  if (passwordValue !== password2.value) {
    window.alert("Please make sure both passwords match.");
    return;
  }

  if (passwordValue.length < 8) {
    window.alert("Your password must be at least 8 characters.");
    return;
  }

  submit.disabled = true;

  try {
    const checkResponse = await axios.post(
      "/check-username",
      { username: usernameValue }
    );

    if (checkResponse.data.exists) {
      window.alert("This username already exists.");
      return;
    }

    const signupResponse = await axios.post(
      "/signup",
      {
        username: usernameValue,
        password: passwordValue,
        firstName: firstNameValue,
        lastName: lastNameValue,
        admin: isAdmin
      }
    );

    if (!signupResponse.data.success) {
      window.alert(
        signupResponse.data.message || "Could not create your account."
      );
      return;
    }

    sessionStorage.setItem("username", usernameValue);

    if (Number(isAdmin) === 1) {
      window.location.href = "Teacher.html";
    } else {
      window.location.href = "PATIENTS.html";
    }
  } catch (error) {
    console.error("Signup error:", error);

    const message =
      error.response?.data?.message ||
      "Could not create your account. Please check that the server is running.";

    window.alert(message);
  } finally {
    submit.disabled = false;
  }
};
