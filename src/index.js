import puppeteer from "@cloudflare/puppeteer";

export default {
	async fetch(request, env) {
		const { searchParams } = new URL(request.url);
		let url = searchParams.get("url");
		if (url) {
			url = new URL(url).toString();
			const browser = await puppeteer.launch(env.BROWSER);
			const page = await browser.newPage();
			console.log(`Browsing to ${url}...`);
			await page.goto(url, {
				waitUntil: 'networkidle2',
			});
			const name = 'foobarbaz.pdf';
			console.log(`Rendering ${url} as PDF...`);
			const pdfBytes = await page.pdf({
				format: 'letter',
			});
			await browser.close();
			console.log(`Rendered ${pdfBytes.length} bytes...`);
			const { etag } = await env.PERSIST_BUCKET.put(name, pdfBytes);
			console.log(`Persisted ${url} as ${name} (etag=${etag})`);
			return new Response(pdfBytes, {
				headers: {
					"content-type": "application/pdf",
					"r2-name": name,
					"r2-etag": etag,
				},
			});
		} else {
			return new Response(
				"Please add an ?url=https://example.com/ parameter"
			);
		}
	},
};