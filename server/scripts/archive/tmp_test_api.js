

async function testUpdate() {
  const loginData = JSON.stringify({ email: 'admin@admin.com', password: 'admin' });
  
  // Need to use the fetch polyfill or node-fetch, but let's just use axios since it's in client or we can just use native fetch if node 18+ is present.
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: loginData
    });
    const loginJson = await loginRes.json();
    console.log("Login res:", loginJson);
    
    if(!loginJson.token) return;
    
    const updateData = JSON.stringify({
        name: 'Test Name Updated',
        type: 'Client',
        status: 'active',
        start_date: '',
        end_date: '',
        pd: '',
        pm: '',
        note: ''
    });

    const updateRes = await fetch('http://localhost:5000/api/projects/1', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginJson.token}`
      },
      body: updateData
    });
    
    const updateJson = await (updateRes.headers.get('content-type')?.includes('json') ? updateRes.json() : updateRes.text());
    console.log("Status:", updateRes.status);
    console.log("Update res:", updateJson);
  } catch (e) {
    console.error("Test script failed", e);
  }
}
testUpdate();
