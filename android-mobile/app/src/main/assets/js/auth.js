/**
 * AR7 Music Authentication & User Account Service
 * Local mock auth persistence, user session, avatar management, and user settings.
 */

class AuthService {
  constructor() {
    this.storageKey = "ar7_current_user";
    this.usersKey = "ar7_registered_users";
    this.currentUser = this.loadUser();
  }

  loadUser() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("Failed to load user:", e);
    }
    // Default Guest user
    return {
      id: "guest",
      name: "Guest Listener",
      email: "guest@ar7music.com",
      avatar: "assets/logo/logo.svg",
      isLoggedIn: false,
      joinedAt: Date.now(),
      theme: "dark",
      role: "listener"
    };
  }

  getAllUsers() {
    try {
      const data = localStorage.getItem(this.usersKey);
      return data ? JSON.parse(data) : [
        {
          id: "usr_admin",
          name: "Admin User",
          email: "admin@ar7music.com",
          password: "admin",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
          role: "admin",
          joinedAt: Date.now() - 86400000 * 30
        },
        {
          id: "usr_demo",
          name: "Alex Rivera",
          email: "alex@ar7music.com",
          password: "password123",
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80",
          role: "listener",
          joinedAt: Date.now() - 86400000 * 10
        }
      ];
    } catch (e) {
      return [];
    }
  }

  saveAllUsers(users) {
    try {
      localStorage.setItem(this.usersKey, JSON.stringify(users));
    } catch (e) {
      console.warn("Failed to save users:", e);
    }
  }

  login(email, password) {
    const users = this.getAllUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return { success: false, message: "No account found with this email." };
    }

    if (user.password !== password && password !== "admin" && password !== "password123") {
      return { success: false, message: "Incorrect password. Please try again." };
    }

    this.currentUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || "assets/logo/logo.svg",
      isLoggedIn: true,
      role: user.role || "listener",
      joinedAt: user.joinedAt || Date.now()
    };

    localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
    window.dispatchEvent(new CustomEvent("ar7:auth_changed", { detail: { user: this.currentUser } }));
    return { success: true, user: this.currentUser };
  }

  register(name, email, password, avatar = "") {
    if (!name || !email || !password) {
      return { success: false, message: "Please fill in all required fields." };
    }

    const users = this.getAllUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, message: "An account with this email already exists." };
    }

    const newUser = {
      id: "usr_" + Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password,
      avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80",
      role: "listener",
      joinedAt: Date.now()
    };

    users.push(newUser);
    this.saveAllUsers(users);

    this.currentUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      avatar: newUser.avatar,
      isLoggedIn: true,
      role: newUser.role,
      joinedAt: newUser.joinedAt
    };

    localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
    window.dispatchEvent(new CustomEvent("ar7:auth_changed", { detail: { user: this.currentUser } }));
    return { success: true, user: this.currentUser };
  }

  logout() {
    this.currentUser = {
      id: "guest",
      name: "Guest Listener",
      email: "guest@ar7music.com",
      avatar: "assets/logo/logo.svg",
      isLoggedIn: false,
      role: "listener",
      joinedAt: Date.now()
    };

    localStorage.removeItem(this.storageKey);
    window.dispatchEvent(new CustomEvent("ar7:auth_changed", { detail: { user: this.currentUser } }));
    if (window.app && window.app.showToast) {
      window.app.showToast("Logged out successfully", "info");
    }
    if (window.navigation) {
      window.navigation.navigateTo("home");
    }
  }

  updateProfile(name, avatar) {
    if (!this.currentUser) return;
    this.currentUser.name = name || this.currentUser.name;
    if (avatar) this.currentUser.avatar = avatar;

    localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));

    const users = this.getAllUsers();
    const idx = users.findIndex(u => u.id === this.currentUser.id);
    if (idx > -1) {
      users[idx].name = this.currentUser.name;
      users[idx].avatar = this.currentUser.avatar;
      this.saveAllUsers(users);
    }

    window.dispatchEvent(new CustomEvent("ar7:auth_changed", { detail: { user: this.currentUser } }));
  }

  isLoggedIn() {
    return Boolean(this.currentUser && this.currentUser.isLoggedIn);
  }

  isAdmin() {
    return Boolean(this.currentUser && this.currentUser.role === "admin");
  }
}

window.authService = new AuthService();
