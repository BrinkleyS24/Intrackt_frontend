export async function fetchData(url, body) {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Error fetching data.");
        return data;
    } catch (error) {
        console.error(`Error fetching from ${url}:`, error);
        alert(error.message);
        throw error;
    }
}
