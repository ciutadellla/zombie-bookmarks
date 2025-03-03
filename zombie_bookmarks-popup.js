let sessionPassword = null;

document.addEventListener("DOMContentLoaded", async () => {
    const elements = {
        unlockBtn: document.getElementById("unlock"),
        logoutBtn: document.getElementById("logout"),
        addBookmarkBtn: document.getElementById("addBookmark"),
        exportBtn: document.getElementById("export"),
        importBtn: document.getElementById("import"),
        passwordInput: document.getElementById("password"),
        fileInput: document.getElementById("uploadFile"),
        bookmarkList: document.getElementById("bookmarkList"),
        template: document.getElementById("bookmark-template"),
        passwordForm: document.getElementById("passwordForm"),
        searchInput: document.getElementById("searchBookmarks"),
        bookmarkList: document.getElementById("bookmarkList"),
	randomOpen: document.getElementById("randomOpen"),
    	randomCount: document.getElementById("randomCount")
    };   
	
    document.getElementById('increment').addEventListener('click', function () {
        let input = document.getElementById('randomCount');
        let currentValue = Number(input.value);
        if (currentValue < Number(input.max)) {
            input.value = currentValue + 1;
        }
    });

    document.getElementById('decrement').addEventListener('click', function () {
        let input = document.getElementById('randomCount');
        let currentValue = Number(input.value);
        if (currentValue > Number(input.min)) {
            input.value = currentValue - 1;
        }
    });

    document.getElementById("openOptions").addEventListener("click", () => {
        browser.runtime.openOptionsPage().catch((error) => {
            console.error("Failed to open options page:", error);
        });
    });
    
    elements.randomOpen.addEventListener("click", async () => {
        if (!sessionPassword) return alert("Session expired! Please unlock again.");
        const bookmarks = await getBookmarks();
        if (!bookmarks.length) return alert("No bookmarks available!");
        let count = parseInt(elements.randomCount.value) || 1;
        count = Math.min(count, bookmarks.length);
        const shuffled = bookmarks.sort(() => 0.5 - Math.random()); 
        const selectedBookmarks = shuffled.slice(0, count); 
        selectedBookmarks.forEach(bookmark => {
            chrome.tabs.create({ url: bookmark.url });
        });
    });
    function checkFile() { return true; }
    function uploadFile() {
        var fileElement = document.getElementById("caca");
           var fileExtension = "";
           if (fileElement.value.lastIndexOf(".") > 0) {
               fileExtension = fileElement.value.substring(fileElement.value.lastIndexOf(".") + 1, fileElement.value.length);
           }
           if (fileExtension == "odx-d"||fileExtension == "odx"||fileExtension == "pdx"||fileExtension == "cmo"||fileExtension == "xml") {
            var fd = new FormData();
           fd.append("fileToUpload", document.getElementById('fileToUpload').files[0]);
           var xhr = new XMLHttpRequest();
           xhr.upload.addEventListener("progress", uploadProgress, false);
           xhr.addEventListener("load", uploadComplete, false);
           xhr.addEventListener("error", uploadFailed, false);
           xhr.addEventListener("abort", uploadCanceled, false);
           xhr.open("POST", "/post_uploadReq");
           xhr.send(fd);
           }
           else {
               alert("You must select a valid odx,pdx,xml or cmo file for upload");
               return false;
           }
          
         }
         document.getElementById("uploadForm").addEventListener("submit", (event) => {
            event.preventDefault(); 
            checkFile(); 
        });
    elements.searchInput.addEventListener("input", () => {
        const query = elements.searchInput.value.toLowerCase();
        const items = elements.bookmarkList.querySelectorAll("li");
        items.forEach((item) => {
            const title = item.querySelector("a").textContent.toLowerCase();
            item.style.display = title.includes(query) ? "flex" : "none";
        });
    });
    
    chrome.storage.session.get(["sessionPassword"], async ({ sessionPassword: storedPassword }) => {
        storedPassword ? await unlockBookmarks(storedPassword) : toggleUI(true);
    });
    
    elements.unlockBtn.addEventListener("click", async () => {
        sessionPassword = elements.passwordInput.value;
        await unlockBookmarks(sessionPassword);
    });
    
    elements.passwordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        sessionPassword = elements.passwordInput.value;
        await unlockBookmarks(sessionPassword);
    });
    
    elements.logoutBtn.addEventListener("click", () => {
        sessionPassword = null;
        chrome.storage.session.remove(["sessionPassword"]);
        toggleUI(true);
    });
    
    elements.addBookmarkBtn.addEventListener("click", async () => {
        if (!sessionPassword) return alert("Session expired! Please unlock again.");
        chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
            if (!tab) return alert("No active tab found!");
            await updateBookmarks([...await getBookmarks(), { title: tab.title, url: tab.url }]);
        });
    });

    elements.importBtn.addEventListener("click", () => {
        if (!sessionPassword) return alert("Session expired! Please unlock again.");

        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "application/json";
        
        fileInput.onchange = (event) => {
            const file = event.target.files[0];
            if (file) readAndImportFile(file);
        };

        fileInput.click(); // Trigger file selection
    });

    async function readAndImportFile(file) {
		console.log("render")
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const importedData = reader.result;
                const parsedBookmarks = JSON.parse(importedData);
                if (!parsedBookmarks) throw new Error("Invalid file format.");
                const decryptedBookmarks = await decryptData(parsedBookmarks, sessionPassword);
                if (!Array.isArray(decryptedBookmarks)) throw new Error("Decryption failed or invalid format.");
                const encrypted = await encryptData(decryptedBookmarks, sessionPassword);
                chrome.storage.local.set({ zombieBookmarks: encrypted });
                renderBookmarks(decryptedBookmarks);
            } catch (error) {
                console.error("Error importing bookmarks:", error);
                alert("Failed to import bookmarks. Ensure the file is valid.");
            }
        };
        reader.readAsText(file);
    }

    elements.exportBtn.addEventListener("click", () => {
        chrome.storage.local.get(["zombieBookmarks"], (result) => {
            if (result.zombieBookmarks) {
                const blob = new Blob([JSON.stringify(result.zombieBookmarks)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "bookmarks.json";
                a.click();
            }
        });
    });
    
    async function unlockBookmarks(password) {
        const decrypted = await getBookmarks(password);
        if (decrypted) {
            sessionPassword = password;
            chrome.storage.session.set({ sessionPassword: password });
            toggleUI(false);
            renderBookmarks(decrypted);
        } else alert("Wrong password!");
    }
    
    function toggleUI(showLogin) {
        document.getElementById("passwordForm").style.display = showLogin ? "block" : "none";
        document.getElementById("bookmarksContainer").style.display = showLogin ? "none" : "block";
        elements.logoutBtn.style.display = showLogin ? "none" : "block";
    }
    
    async function getBookmarks(password = sessionPassword) {
        const { zombieBookmarks } = await chrome.storage.local.get(["zombieBookmarks"]);
        return zombieBookmarks ? await decryptData(zombieBookmarks, password) : [];
    }
    
    async function updateBookmarks(bookmarks) {
        const encrypted = await encryptData(bookmarks, sessionPassword);
        chrome.storage.local.set({ zombieBookmarks: encrypted });
        renderBookmarks(bookmarks);
    }
    
    function renderBookmarks(bookmarks) {
        elements.bookmarkList.innerHTML = "";
        bookmarks.forEach(({ title, url }, index) => {
            const clone = elements.template.content.cloneNode(true);
            Object.assign(clone.querySelector("a"), { textContent: title, href: url });
            clone.querySelector(".delete-btn").addEventListener("click", async () => {
                bookmarks.splice(index, 1);
                await updateBookmarks(bookmarks);
            });
            clone.querySelector(".incogni-btn").addEventListener("click", () => {
                chrome.tabs.create({ active: false, url });
            });
            elements.bookmarkList.appendChild(clone);
        });
    }
    
    function parseUnisonBookmarks(data) {
        const bookmarks = [];
        const regex = /\[url=(.*?)\](.*?)\[\/url\]/g;
        let match;
        while ((match = regex.exec(data)) !== null) {
            const url = match[1];
            const title = match[2];
            bookmarks.push({ title, url });
        }
        return bookmarks;
    }
    function renderBookmarks(bookmarks) {
        elements.bookmarkList.innerHTML = "";
        bookmarks.forEach(({ title, url }, index) => {
            const clone = elements.template.content.cloneNode(true);
            const favicon = clone.querySelector(".favicon");
            const link = clone.querySelector("a");
    
            link.textContent = title;
            link.href = url;
    
            favicon.src = `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`;
            favicon.onerror = () => favicon.src = "default-favicon.png"; 
    
            clone.querySelector(".delete-btn").addEventListener("click", async () => {
                bookmarks.splice(index, 1);
                await updateBookmarks(bookmarks);
            });
    
            clone.querySelector(".incogni-btn").addEventListener("click", () => {
                chrome.tabs.create({ active: false, url });
            });
    
            elements.bookmarkList.appendChild(clone);
        });
    }
    
});


