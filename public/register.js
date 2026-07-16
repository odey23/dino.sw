const registerForm = document.getElementById("registerForm");
const registerButton = document.getElementById("registerButton");
const registerMessage = document.getElementById("message");

function showMessage(text, type) {
  registerMessage.textContent = text;
  registerMessage.className = type;
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  showMessage("", "");

  if (!username || !password || !confirmPassword) {
    showMessage("Please complete all fields.", "error");
    return;
  }

  if (password !== confirmPassword) {
    showMessage("The passwords do not match.", "error");
    return;
  }

  registerButton.disabled = true;
  registerButton.textContent = "Creating account...";

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      showMessage(data.message || "Could not create the account.", "error");
      return;
    }

    showMessage("Account created. Taking you to login...", "success");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);
  } catch (error) {
    console.error("Registration error:", error);
    showMessage("Could not connect to the server.", "error");
  } finally {
    registerButton.disabled = false;
    registerButton.textContent = "Create account";
  }
});
