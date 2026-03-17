
const urls = ['http://localhost:5000/api/dashboard/stats'];

async function trigger() {
    for (const url of urls) {
        try {
            const res = await fetch(url);
            console.log(`Fetch ${url}: ${res.status}`);
        } catch (e) {
            console.error(`Fetch error ${url}:`, e.message);
        }
    }
}

trigger();
