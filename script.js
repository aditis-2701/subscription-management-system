async function apiRequest(path, options = {}) {
    const response = await fetch(
        `http://127.0.0.1:5001/api${path}`,
        {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'The request failed.');
    }

    return data;
}