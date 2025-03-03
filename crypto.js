async function encryptData(data, password) {
    const encoder = new TextEncoder();
    const encodedKey = await crypto.subtle.digest("SHA-256", encoder.encode(password));
    const key = await crypto.subtle.importKey("raw", encodedKey, { name: "AES-GCM" }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(data)));
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
}

async function decryptData(encryptedData, password) {
    try {
        const encoder = new TextEncoder();
        const encodedKey = await crypto.subtle.digest("SHA-256", encoder.encode(password));
        const key = await crypto.subtle.importKey("raw", encodedKey, { name: "AES-GCM" }, false, ["decrypt"]);
        const iv = new Uint8Array(encryptedData.iv);
        const encrypted = new Uint8Array(encryptedData.data);
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
        return null;
    }
}

