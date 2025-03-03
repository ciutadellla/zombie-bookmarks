const browserAPI = typeof browser !== "undefined" ? browser : chrome;


// Ensure the extension is installed and create the context menu
browserAPI.runtime.onInstalled.addListener(() => {
    console.log("Zombie Bookmarks Extension Installed.");

    // Remove any existing context menus to avoid duplicate ID errors
    browserAPI.contextMenus.removeAll(() => {
        // Create a context menu for saving bookmarks
        browserAPI.contextMenus.create({
            id: "saveBookmark",
            title: "Save to Zombie Bookmarks",
            contexts: ["page"]
        });
    });
});

// Handle context menu click event
browserAPI.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "saveBookmark") {
        let password = prompt("Enter password to save:");
        if (!password) {
            alert("Password required!");
            return;
        }

        try {
            // Fetch stored bookmarks
            let result = await browserAPI.storage.local.get("zombieBookmarks");
            let bookmarks = result.zombieBookmarks ? await decryptData(result.zombieBookmarks, password) : [];

            // Add new bookmark
            bookmarks.push({ title: tab.title, url: tab.url });

            // Encrypt and save bookmarks
            const encrypted = await encryptData(bookmarks, password);
            await browserAPI.storage.local.set({ zombieBookmarks: encrypted });

            alert("Bookmark saved zombiely!");
        } catch (error) {
            console.error("Error saving bookmark:", error);
            alert("Failed to save bookmark.");
        }
    }
});
