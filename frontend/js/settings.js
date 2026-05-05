/**
 * Settings page behavior for theme, sign-in state, and profile image.
 */

document.addEventListener("DOMContentLoaded", () => {
    initThemeControls();
    initProfileForm();
    initNotificationControls();
    initDashboardPreferenceControls();
    initResetControls();
    renderSettings(getPreferences());
});

function initThemeControls() {
    document.querySelectorAll("[data-theme-option]").forEach((button) => {
        button.addEventListener("click", () => {
            savePreferences({ theme: button.dataset.themeOption });
            renderSettings(getPreferences());
        });
    });
}

function initProfileForm() {
    const form = document.getElementById("profile-form");
    const imageInput = document.getElementById("profile-image-input");
    const clearImageButton = document.getElementById("clear-profile-image");
    const signOutButton = document.getElementById("sign-out");

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = document.getElementById("profile-name").value.trim();
        const email = document.getElementById("profile-email").value.trim();

        savePreferences({
            signedIn: true,
            name,
            email,
        });
        renderSettings(getPreferences());
    });

    imageInput.addEventListener("change", () => {
        const file = imageInput.files && imageInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.addEventListener("load", () => {
            savePreferences({ profileImage: reader.result });
            renderSettings(getPreferences());
        });
        reader.readAsDataURL(file);
    });

    clearImageButton.addEventListener("click", () => {
        imageInput.value = "";
        savePreferences({ profileImage: "" });
        renderSettings(getPreferences());
    });

    signOutButton.addEventListener("click", () => {
        imageInput.value = "";
        savePreferences({
            signedIn: false,
            name: "",
            email: "",
            profileImage: "",
        });
        renderSettings(getPreferences());
    });
}

function initNotificationControls() {
    const notificationMap = {
        "price-alerts": "priceAlerts",
        "daily-summary": "dailySummary",
        "signal-alerts": "signalAlerts",
        "weekly-digest": "weeklyDigest",
    };

    Object.entries(notificationMap).forEach(([inputId, preferenceKey]) => {
        const input = document.getElementById(inputId);

        input.addEventListener("change", () => {
            savePreferences({ [preferenceKey]: input.checked });
            renderSettings(getPreferences());
        });
    });
}

function initDashboardPreferenceControls() {
    const defaultStockInput = document.getElementById("default-stock-symbol");
    const preferredChartRange = document.getElementById("preferred-chart-range");
    const showSavedStocksFirst = document.getElementById("show-saved-stocks-first");

    defaultStockInput.addEventListener("input", () => {
        const normalizedSymbol = defaultStockInput.value
            .toUpperCase()
            .replace(/[^A-Z.]/g, "")
            .slice(0, 10);

        if (defaultStockInput.value !== normalizedSymbol) {
            defaultStockInput.value = normalizedSymbol;
        }

        savePreferences({ defaultStockSymbol: normalizedSymbol });
    });

    preferredChartRange.addEventListener("change", () => {
        savePreferences({ preferredChartRange: preferredChartRange.value });
    });

    showSavedStocksFirst.addEventListener("change", () => {
        savePreferences({ showSavedStocksFirst: showSavedStocksFirst.checked });
    });
}

function initResetControls() {
    const resetButton = document.getElementById("reset-preferences");
    const resetFeedback = document.getElementById("reset-feedback");
    const imageInput = document.getElementById("profile-image-input");

    resetButton.addEventListener("click", () => {
        imageInput.value = "";
        const preferences = resetPreferences();
        renderSettings(preferences);
        resetFeedback.textContent = "Preferences restored to default settings.";
        resetFeedback.classList.add("is-visible");
    });
}

function renderSettings(preferences) {
    const resetFeedback = document.getElementById("reset-feedback");

    document.querySelectorAll("[data-theme-option]").forEach((button) => {
        button.classList.toggle("active", button.dataset.themeOption === preferences.theme);
    });

    document.getElementById("profile-name").value = preferences.name || "";
    document.getElementById("profile-email").value = preferences.email || "";
    document.getElementById("price-alerts").checked = preferences.priceAlerts;
    document.getElementById("daily-summary").checked = preferences.dailySummary;
    document.getElementById("signal-alerts").checked = preferences.signalAlerts;
    document.getElementById("weekly-digest").checked = preferences.weeklyDigest;
    document.getElementById("default-stock-symbol").value = preferences.defaultStockSymbol || "";
    document.getElementById("preferred-chart-range").value = preferences.preferredChartRange;
    document.getElementById("show-saved-stocks-first").checked = preferences.showSavedStocksFirst;
    document.getElementById("profile-preview-name").textContent =
        preferences.signedIn ? preferences.name || "Signed in" : "Guest";
    document.getElementById("profile-preview-email").textContent =
        preferences.signedIn ? preferences.email || "No email saved" : "Not signed in";

    const previewImage = document.getElementById("profile-preview-image");
    const previewInitials = document.getElementById("profile-preview-initials");

    if (preferences.profileImage) {
        previewImage.src = preferences.profileImage;
        previewImage.hidden = false;
        previewInitials.hidden = true;
    } else {
        previewImage.removeAttribute("src");
        previewImage.hidden = true;
        previewInitials.hidden = false;
        previewInitials.textContent = getProfileInitials(preferences);
    }

    if (resetFeedback) {
        resetFeedback.textContent = "";
        resetFeedback.classList.remove("is-visible");
    }
}
