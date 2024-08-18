import puppeteer from "@cloudflare/puppeteer";

export default {
	async fetch(request, env) {
		const allow = await env.KV_STORE.get("token");
		const token = request.headers.get("x-hlte-token");
		if (!token || token !== allow) {
			return new Response(null, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		let url = searchParams.get("url");
		const hlteUuid = searchParams.get("hlteUuid");

		if (!url || !hlteUuid) {
			return new Response("url & hlteUuid parameters are required");
		}

		url = new URL(url).toString();
		const browser = await puppeteer.launch(env.BROWSER);
		const page = await browser.newPage();

		console.log(`Browsing to ${url}...`);
		await page.goto(url, {
			waitUntil: 'networkidle2',
		});

		let pdfOpts = { format: 'letter' };
		const optsParam = searchParams.get("pdfOpts");
		if (optsParam) {
			try {
				pdfOpts = { ...pdfOpts, ...JSON.parse(atob(optsParam)) };
			} catch (error) {
				console.error('pdfOpts', optsParam, error)
			}
		}
		console.log(`Rendering ${url} as PDF...`, pdfOpts);
		const pdfBytes = await page.pdf(pdfOpts);
		console.log(`Rendered ${pdfBytes.length} PDF bytes...`);

		console.log(`Screenshotting ${url}...`);
		const ssBytes = await page.screenshot({ fullPage: true });
		console.log(`Rendered ${ssBytes.length} screenshot bytes...`);

		await browser.close();

		const pdfRes = await env.PERSIST_BUCKET.put(hlteUuid + ".pdf", pdfBytes);
		console.log(`Persisted ${url} to PDF (etag=${pdfRes.etag})`);

		const imgRes = await env.PERSIST_BUCKET.put(hlteUuid + ".png", ssBytes);
		console.log(`Persisted ${url} to PNG (etag=${imgRes.etag})`);

		return new Response(JSON.stringify({
			input: { url, hlteUuid },
			outputs: {
				pdf: pdfRes,
				png: imgRes
			}
		}), {
			headers: {
				"content-type": "text/json",
			},
		});
	},
};