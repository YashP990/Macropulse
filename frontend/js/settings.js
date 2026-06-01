/**
 * Settings page behavior for theme, sign-in state, and profile image.
 */
/* Yash Patel, 05/14/2026
Initializes color-blind mode control buttons and functionality*/
document.addEventListener("DOMContentLoaded", () => {
    initThemeControls();
    initColorBlindModeControls();
    initProfileForm();
    initNotificationControls();
    initDashboardPreferenceControls();
    initPrivacyPreferenceControls();
    initDataPrivacyCenter();
    initStrategyWeightControls();
    initResetControls();
    renderSettings(getPreferences());
    loadApiKeySecurityStatus();
});

function initThemeControls() {
    document.querySelectorAll("[data-theme-option]").forEach((button) => {
        button.addEventListener("click", () => {
            savePreferences({ theme: button.dataset.themeOption });
            renderSettings(getPreferences());
        });
    });
}
/* Yash Patel, 05/14/2026
Adds click events for updating and saving selected color-blind display mode*/
function initColorBlindModeControls() {
    document.querySelectorAll("[data-color-blind-mode]").forEach((button) => {
        button.addEventListener("click", () => {
            savePreferences({ colorBlindMode: button.dataset.colorBlindMode });
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


function initPrivacyPreferenceControls() {
    const privacyMap = {
        "private-mode": "privateMode",
        "hide-profile-name": "hideProfileName",
        "hide-profile-email": "hideProfileEmail",
    };
    const clearSavedStocksButton = document.getElementById("clear-saved-stocks");
    const privacyFeedback = document.getElementById("privacy-feedback");

    Object.entries(privacyMap).forEach(([inputId, preferenceKey]) => {
        const input = document.getElementById(inputId);

        input.addEventListener("change", () => {
            savePreferences({ [preferenceKey]: input.checked });
            renderSettings(getPreferences());
        });
    });

    clearSavedStocksButton.addEventListener("click", () => {
        localStorage.removeItem("macropulseSavedStocks");
        privacyFeedback.textContent = "Saved stocks cleared from this browser.";
        privacyFeedback.classList.add("is-visible");
        renderDataPrivacyCenter();
    });
}
// Mubashir - US-F: Strategy weight sliders with coupled redistribution
function initStrategyWeightControls() {
    const sliders = Array.from(document.querySelectorAll("#strategy-weights-form input[type=range]"));
    const resetBtn = document.getElementById("reset-weights");
    const feedback = document.getElementById("weights-feedback");
    if (!sliders.length) return;

    function getStrategyKey(slider) {
        return slider.getAttribute("data-strategy");
    }

    function updateLabelsAndTotal() {
        let total = 0;
        sliders.forEach((s) => {
            const val = parseInt(s.value, 10);
            total += val;
            const label = document.getElementById(`${s.id}-val`);
            if (label) label.textContent = `${val}%`;
        });
        const totalEl = document.getElementById("weight-total");
        if (totalEl) {
            totalEl.textContent = `${total}%`;
            totalEl.style.color = total === 100 ? "var(--accent-green)" : "var(--accent-red)";
        }
    }

    function saveWeights() {
        const weights = {};
        sliders.forEach((s) => {
            weights[getStrategyKey(s)] = parseInt(s.value, 10);
        });
        savePreferences({ strategyWeights: weights });
        if (feedback) {
            feedback.textContent = "Weights saved.";
            feedback.classList.add("is-visible");
            clearTimeout(feedback._timeout);
            feedback._timeout = setTimeout(() => {
                feedback.textContent = "";
                feedback.classList.remove("is-visible");
            }, 1500);
        }
    }

    sliders.forEach((movedSlider) => {
        movedSlider.addEventListener("input", () => {
            const movedVal = parseInt(movedSlider.value, 10);
            const others = sliders.filter((s) => s !== movedSlider);

            // Sum of other sliders before redistribution
            const othersSum = others.reduce((sum, s) => sum + parseInt(s.value, 10), 0);
            const remaining = 100 - movedVal;

            if (othersSum === 0) {
                // Distribute remaining evenly if all others are at 0
                const each = Math.floor(remaining / others.length);
                others.forEach((s, i) => {
                    s.value = i === others.length - 1 ? remaining - each * (others.length - 1) : each;
                });
            } else {
                // Scale proportionally
                let distributed = 0;
                others.forEach((s, i) => {
                    if (i === others.length - 1) {
                        s.value = Math.max(0, remaining - distributed);
                    } else {
                        const share = Math.round((parseInt(s.value, 10) / othersSum) * remaining);
                        s.value = Math.max(0, share);
                        distributed += parseInt(s.value, 10);
                    }
                });
            }

            updateLabelsAndTotal();
            saveWeights();
        });
    });

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            const defaults = DEFAULT_STRATEGY_WEIGHTS;
            sliders.forEach((s) => {
                s.value = defaults[getStrategyKey(s)] || 0;
            });
            updateLabelsAndTotal();
            saveWeights();
        });
    }
}

function initDataPrivacyCenter() {
    document.querySelectorAll("[data-clear-storage]").forEach((button) => {
        button.addEventListener("click", () => {
            const key = button.dataset.clearStorage;
            const label = button.closest(".data-privacy-row")?.querySelector("strong")?.textContent || "Local data";
            localStorage.removeItem(key);
            renderDataPrivacyCenter();

            const feedback = document.getElementById("data-privacy-feedback");
            if (feedback) {
                feedback.textContent = `${label} cleared from this browser.`;
                feedback.classList.add("is-visible");
            }
        });
    });

    renderDataPrivacyCenter();
}

function readStoredArrayCount(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value.length : 0;
    } catch {
        return 0;
    }
}

function readStoredObjectCount(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "{}");
        return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).length : 0;
    } catch {
        return 0;
    }
}

function renderDataPrivacyCenter() {
    const savedStocks = document.getElementById("saved-stocks-count");
    const recentSearches = document.getElementById("recent-searches-count");
    const recentComparisons = document.getElementById("recent-comparisons-count");
    const journalTags = document.getElementById("journal-tags-count");

    if (savedStocks) savedStocks.textContent = `${readStoredArrayCount("macropulseSavedStocks")} symbols stored`;
    if (recentSearches) recentSearches.textContent = `${readStoredArrayCount("macropulseRecentSearches")} searches stored`;
    if (recentComparisons) recentComparisons.textContent = `${readStoredArrayCount("macropulseRecentComparisons")} comparisons stored`;
    if (journalTags) journalTags.textContent = `${readStoredObjectCount("macropulseJournalTags")} tagged trades stored`;
}

function initResetControls() {
    const resetButton = document.getElementById("reset-preferences");
    const resetFeedback = document.getElementById("reset-feedback");
    const privacyFeedback = document.getElementById("privacy-feedback");
    const imageInput = document.getElementById("profile-image-input");

    resetButton.addEventListener("click", () => {
        imageInput.value = "";
        const preferences = resetPreferences();
        renderSettings(preferences);
        renderDataPrivacyCenter();
        resetFeedback.textContent = "Preferences restored to default settings.";
        resetFeedback.classList.add("is-visible");
    });
}

function renderSettings(preferences) {
    const resetFeedback = document.getElementById("reset-feedback");
    const privacyFeedback = document.getElementById("privacy-feedback");

    document.querySelectorAll("[data-theme-option]").forEach((button) => {
        button.classList.toggle("active", button.dataset.themeOption === preferences.theme);
    });
/* Yash Patel, 05/14/2026
Highlights the currently selected color-blind mode button in the settings menu*/
    document.querySelectorAll("[data-color-blind-mode]").forEach((button) => {
        button.classList.toggle("active", button.dataset.colorBlindMode === preferences.colorBlindMode);
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
    document.getElementById("private-mode").checked = preferences.privateMode;
    document.getElementById("hide-profile-name").checked = preferences.hideProfileName;
    document.getElementById("hide-profile-email").checked = preferences.hideProfileEmail;
    document.getElementById("profile-preview-name").textContent =
        preferences.privateMode || preferences.hideProfileName
            ? "Private Profile"
            : preferences.signedIn ? preferences.name || "Signed in" : "Guest";
    document.getElementById("profile-preview-email").textContent =
        preferences.privateMode || preferences.hideProfileEmail
            ? "Email hidden"
            : preferences.signedIn ? preferences.email || "No email saved" : "Not signed in";

    const previewImage = document.getElementById("profile-preview-image");
    const previewInitials = document.getElementById("profile-preview-initials");

    if (preferences.privateMode) {
        previewImage.removeAttribute("src");
        previewImage.hidden = true;
        previewInitials.hidden = false;
        previewInitials.textContent = "P";
    } else if (preferences.profileImage) {
        previewImage.src = preferences.profileImage;
        previewImage.hidden = false;
        previewInitials.hidden = true;
    } else {
        previewImage.removeAttribute("src");
        previewImage.hidden = true;
        previewInitials.hidden = false;
        previewInitials.textContent = getProfileInitials(preferences);
    }

    // Render strategy weight sliders
    const weights = preferences.strategyWeights || DEFAULT_STRATEGY_WEIGHTS;
    document.querySelectorAll("#strategy-weights-form input[type=range]").forEach((slider) => {
        const key = slider.getAttribute("data-strategy");
        if (key && weights[key] != null) {
            slider.value = weights[key];
            const label = document.getElementById(`${slider.id}-val`);
            if (label) label.textContent = `${weights[key]}%`;
        }
    });
    const totalEl = document.getElementById("weight-total");
    if (totalEl) {
        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        totalEl.textContent = `${total}%`;
        totalEl.style.color = total === 100 ? "var(--accent-green)" : "var(--accent-red)";
    }

    if (resetFeedback) {
        resetFeedback.textContent = "";
        resetFeedback.classList.remove("is-visible");
    }

    if (privacyFeedback) {
        privacyFeedback.textContent = "";
        privacyFeedback.classList.remove("is-visible");
    }
}

async function loadApiKeySecurityStatus() {
    const list = document.getElementById("api-key-security-list");
    if (!list || typeof getSecurityConfig !== "function") return;

    try {
        const data = await getSecurityConfig();
        renderApiKeySecurityStatus(data.providers || []);
    } catch {
        list.innerHTML = `
            <div class="security-status-row is-error">
                <span>Security status unavailable</span>
                <span class="security-status-badge missing">Unavailable</span>
            </div>
        `;
    }
}

function renderApiKeySecurityStatus(providers) {
    const list = document.getElementById("api-key-security-list");
    if (!list) return;

    const statusLabels = {
        configured: "Configured",
        missing: "Missing",
        no_key_needed: "No key needed",
    };

    list.innerHTML = providers
        .map((provider) => {
            const status = provider.status || "missing";
            return `
                <div class="security-status-row">
                    <span>${provider.name}</span>
                    <span class="security-status-badge ${status}">${statusLabels[status] || "Missing"}</span>
                </div>
            `;
        })
        .join("");
}


