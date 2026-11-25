// Tokens stay in memory. Refreshing the page requires signing in again.
let token = null;
let busy = false;

const authSection = document.querySelector("#auth-section");
const accountSection = document.querySelector("#account-section");
const messageBox = document.querySelector("#message");
const registerForm = document.querySelector("#register-form");
const loginForm = document.querySelector("#login-form");
const updateForm = document.querySelector("#update-form");
const deleteDialog = document.querySelector("#delete-dialog");

function showMessage(message, isError = false) {
  messageBox.textContent = message;
  messageBox.classList.toggle("error", isError);
  messageBox.hidden = false;
  messageBox.scrollIntoView({ block: "nearest" });
}

function clearSession() {
  token = null;
  authSection.hidden = false;
  accountSection.hidden = true;
  loginForm.reset();
  updateForm.reset();
  for (const id of ["profile-name", "profile-email", "profile-role", "profile-created", "profile-avatar"]) {
    document.getElementById(id).textContent = "";
  }
}

function displayAccount(user) {
  authSection.hidden = true;
  accountSection.hidden = false;
  document.querySelector("#profile-name").textContent = user.name;
  document.querySelector("#profile-email").textContent = user.email;
  document.querySelector("#profile-role").textContent = user.role === "COUNSELOR" ? "Counselor" : "Client";
  document.querySelector("#profile-created").textContent = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
  document.querySelector("#profile-avatar").textContent = Array.from(user.name.trim())[0]?.toUpperCase() ?? "M";
  updateForm.elements.namedItem("name").value = user.name;
  updateForm.elements.namedItem("password").value = "";
}

// All requests use the same Express server; no separate frontend URL is needed.
async function api(path, method = "GET", body) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not connect. Check your connection and try again.");
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : {};

  if (!response.ok) {
    const sessionExpired = response.status === 401 && token;
    if (sessionExpired) clearSession();
    const details = Array.isArray(data.errors)
      ? data.errors.map((error) => error.message).join(" ")
      : "";
    throw new Error(sessionExpired
      ? "Your session has ended. Please sign in again."
      : details || data.message || `Request failed (${response.status}).`);
  }
  return data;
}

async function runAction(action) {
  if (busy) return;
  busy = true;
  const buttons = document.querySelectorAll("button");
  buttons.forEach((button) => { button.disabled = true; });
  document.querySelector("main").setAttribute("aria-busy", "true");
  messageBox.hidden = true;
  try {
    await action();
  } catch (error) {
    showMessage(error.message || "Something went wrong. Please try again.", true);
  } finally {
    busy = false;
    buttons.forEach((button) => { button.disabled = false; });
    document.querySelector("main").removeAttribute("aria-busy");
  }
}

registerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(async () => {
    const form = new FormData(registerForm);
    const data = await api("/auth/register", "POST", {
      name: form.get("name").trim(),
      email: form.get("email").trim(),
      password: form.get("password"),
      role: form.get("role"),
    });
    registerForm.reset();
    loginForm.elements.namedItem("email").value = data.user.email;
    showMessage("Your account is ready. Sign in to make yourself at home.");
    loginForm.elements.namedItem("password").focus();
  });
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(async () => {
    const form = new FormData(loginForm);
    const login = await api("/auth/login", "POST", {
      email: form.get("email").trim(),
      password: form.get("password"),
    });
    token = login.token;
    try {
      const data = await api("/users/me");
      displayAccount(data.user);
    } catch (error) {
      clearSession();
      throw error;
    }
    loginForm.reset();
    document.querySelector("#profile-name").focus();
    showMessage("Welcome back. You're signed in.");
  });
});

updateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(async () => {
    const form = new FormData(updateForm);
    const changes = { name: form.get("name").trim() };
    if (form.get("password") !== "") changes.password = form.get("password");
    const data = await api("/users/me", "PATCH", changes);
    displayAccount(data.user);
    showMessage("All saved. Your account details are up to date.");
  });
});

document.querySelector("#logout-button").addEventListener("click", () => {
  clearSession();
  showMessage("You've signed out. See you again soon.");
  loginForm.elements.namedItem("email").focus();
});

document.querySelector("#delete-button").addEventListener("click", () => {
  deleteDialog.returnValue = "cancel";
  deleteDialog.showModal();
});

deleteDialog.addEventListener("close", () => {
  if (deleteDialog.returnValue !== "delete") return;
  runAction(async () => {
    await api("/users/me", "DELETE");
    clearSession();
    showMessage("Your account has been deleted.");
    loginForm.elements.namedItem("email").focus();
  });
});
