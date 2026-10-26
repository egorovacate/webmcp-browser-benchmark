const port = Number(process.env.SELF_RUN_PORT ?? 5899);
const [first, second] = process.argv.slice(2);
const base = `http://127.0.0.1:${port}`;
let response;
if (first === '--info') response = await fetch(`${base}/info`);
else if (first === '--finish') response = await fetch(`${base}/finish`, { method: 'POST', body: JSON.stringify({ answer: second }) });
else response = await fetch(`${base}/call`, { method: 'POST', body: JSON.stringify({ tool: first, args: second ? JSON.parse(second) : {} }) });
console.log(await response.text());
