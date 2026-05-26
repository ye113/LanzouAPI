const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36';

function randIP() {
	const ip1 = ['218','218','66','66','218','218','60','60','202','204','66','66','66','59','61','60','222','221','66','59','60','60','66','218','218','62','63','64','66','66','122','211'];
	const ip2id = Math.round(Math.random() * (2550000 - 600000) + 600000) / 10000;
	const ip3id = Math.round(Math.random() * (2550000 - 600000) + 600000) / 10000;
	const ip4id = Math.round(Math.random() * (2550000 - 600000) + 600000) / 10000;
	const ip1id = ip1[Math.floor(Math.random() * ip1.length)];
	return `${ip1id}.${ip2id}.${ip3id}.${ip4id}`;
}

async function fetchPage(url, cookie = '', referer = '') {
	const headers = { 'User-Agent': USER_AGENT, 'X-Forwarded-For': randIP(), 'CLIENT-IP': randIP() };
	if (cookie) headers['Cookie'] = cookie;
	if (referer) headers['Referer'] = referer;
	const resp = await fetch(url, { headers });
	return await resp.text();
}

async function postData(post_data, url, referer = '', cookie = '') {
	const headers = {
		'User-Agent': USER_AGENT,
		'Content-Type': 'application/x-www-form-urlencoded',
		'X-Forwarded-For': randIP(),
		'CLIENT-IP': randIP(),
	};
	if (cookie) headers['Cookie'] = cookie;
	if (referer) headers['Referer'] = referer;
	const resp = await fetch(url, { method: 'POST', headers, body: new URLSearchParams(post_data) });
	return await resp.text();
}

async function fetchRedirectUrl(url, referer = '', cookie = '') {
	const headers = {
		'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
		'Accept-Encoding': 'gzip, deflate',
		'Accept-Language': 'zh-CN,zh;q=0.9',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
		'Pragma': 'no-cache',
		'Upgrade-Insecure-Requests': '1',
		'User-Agent': USER_AGENT,
		'X-Forwarded-For': randIP(),
		'CLIENT-IP': randIP(),
	};
	if (cookie) headers['Cookie'] = cookie;
	if (referer) headers['Referer'] = referer;
	const resp = await fetch(url, { headers, redirect: 'manual' });
	return resp.headers.get('Location') || resp.headers.get('location') || url;
}

function acwScV2Simple(arg1) {
	const posList = [15,35,29,24,33,16,1,38,10,9,19,31,40,27,22,23,25,13,6,11,39,18,20,8,14,21,32,26,2,30,7,4,17,5,3,28,34,37,12,36];
	const mask = '3000176000856006061501533003690027800375';
	const outPutList = new Array(40).fill('');
	for (let i = 0; i < arg1.length; i++) {
		const char = arg1[i];
		for (let j = 0; j < posList.length; j++) {
			if (posList[j] === i + 1) outPutList[j] = char;
		}
	}
	const arg2 = outPutList.join('');
	let result = '';
	const len = Math.min(arg2.length, mask.length);
	for (let i = 0; i < len; i += 2) {
		const xorResult = parseInt(arg2.substring(i, i + 2), 16) ^ parseInt(mask.substring(i, i + 2), 16);
		result += xorResult.toString(16).padStart(2, '0');
	}
	return result;
}

export default {
	async fetch(request, env, ctx) {
		const CACHE_TTL = parseInt(env.CACHE_TTL || '1800');
		const COOKIE = env.COOKIE || '';
		const LANZOU_DOMAIN = env.LANZOU_DOMAIN || 'www.lanzouf.com';

		const reqUrl = new URL(request.url);
		const params = reqUrl.searchParams;
		const inputUrl = params.get('url');
		const pwd = params.get('pwd');
		const type = params.get('type');
		const rename = params.get('n');

		const shouldCache = inputUrl && type !== 'down';
		if (shouldCache) {
			const cached = await caches.default.match(new Request(request.url));
			if (cached) return cached;
		}

		if (!inputUrl) {
			return new Response(JSON.stringify({ code: 400, msg: '请输入URL' }, null, 2), {
				headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
			});
		}

		const webpage = inputUrl.includes('?') ? inputUrl.split('?')[1] : '';
		const comIdx = inputUrl.indexOf('.com/');
		const normUrl = 'https://' + LANZOU_DOMAIN + '/' + inputUrl.substring(comIdx + 5);

		let cookie = COOKIE;
		let html = await fetchPage(normUrl, 'acw_sc__v2=' + cookie);

		if (html.includes('文件取消分享了')) {
			return new Response(JSON.stringify({ code: 400, msg: '文件取消分享了' }, null, 2), {
				headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
			});
		}

		let softName = '';
		let m = html.match(/style="font-size: 30px;text-align: center;padding: 56px 0px 20px 0px;">(.*?)<\/div>/);
		if (!m) m = html.match(/<div class="n_box_3fn".*?>(.*?)<\/div>/);
		if (!m) m = html.match(/var filename = '(.*?)';/);
		if (!m) m = html.match(/div class="b"><span>(.*?)<\/span><\/div>/);
		softName = m ? m[1] : '';

		let softFilesize = '';
		m = html.match(/<div class="n_filesize".*?>大小：(.*?)<\/div>/);
		if (!m) m = html.match(/<span class="p7">文件大小：<\/span>(.*?)<br>/);
		softFilesize = m ? m[1] : '';

		if (webpage) html = await fetchPage(normUrl + '?' + webpage);

		let softInfo;

		if (html.includes('function down_p(') && !webpage) {
			if (!pwd) {
				return new Response(JSON.stringify({ code: 400, msg: '请输入分享密码' }, null, 2), {
					headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
				});
			}
			const signMatch = [...html.matchAll(/'sign':'(.*?)',/g)];
			const ajaxmMatch = html.match(/ajaxm\.php\?file=(\d+)/);
			if (!signMatch || signMatch.length < 2 || !ajaxmMatch) {
				return new Response(JSON.stringify({ code: 400, msg: '解析失败' }, null, 2), {
					headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
				});
			}
			const postDataObj = { action: 'downprocess', sign: signMatch[1][1], p: pwd, kd: 1 };
			const respText = await postData(postDataObj, 'https://' + LANZOU_DOMAIN + '/' + ajaxmMatch[0], normUrl);
			softInfo = JSON.parse(respText);
			softName = softInfo.inf || '';
		} else {
			m = html.match(/\n<iframe.*?name="[\s\S]*?"\ssrc="\/(.*?)"/);
			if (!m) m = html.match(/<iframe.*?name="[\s\S]*?"\ssrc="\/(.*?)"/);
			if (!m) {
				return new Response(JSON.stringify({ code: 400, msg: '解析失败' }, null, 2), {
					headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
				});
			}
			const ifurl = 'https://' + LANZOU_DOMAIN + '/' + m[1];
			let segment, ajaxm;
			if (webpage) {
				segment = [...html.matchAll(/'sign':'(.*?)',/g)];
				ajaxm = html.match(/ajaxm\.php\?file=(\d+)/);
				if (!segment || !ajaxm) {
					return new Response(JSON.stringify({ code: 400, msg: '解析失败' }, null, 2), {
						headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
					});
				}
				const postDataObj = { action: 'downprocess', websignkey: 'Em2R', sign: segment[1][1], websign: 2, kd: 1, ves: 1 };
				const respText = await postData(postDataObj, 'https://' + LANZOU_DOMAIN + '/' + ajaxm[0], normUrl);
				softInfo = JSON.parse(respText);
			} else {
				const iframeHtml = await fetchPage(ifurl, 'acw_sc__v2=' + cookie);
				const wpSignMatch = iframeHtml.match(/wp_sign = '(.*?)'/);
				const ajaxdataMatch = iframeHtml.match(/ajaxdata = '(.*?)'/);
				ajaxm = iframeHtml.match(/ajaxm\.php\?file=(\d+)/);
				if (!wpSignMatch || !ajaxdataMatch || !ajaxm) {
					return new Response(JSON.stringify({ code: 400, msg: '解析失败' }, null, 2), {
						headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
					});
				}
				const postDataObj = { action: 'downprocess', websignkey: ajaxdataMatch[1], signs: ajaxdataMatch[1], sign: wpSignMatch[1], websign: '', kd: 1, ves: 1 };
				const respText = await postData(postDataObj, 'https://' + LANZOU_DOMAIN + '/' + ajaxm[0], ifurl, 'acw_sc__v2=' + cookie);
				softInfo = JSON.parse(respText);
			}
		}

		if (softInfo.zt !== 1) {
			return new Response(JSON.stringify({ code: 400, msg: softInfo.inf }, null, 2), {
				headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
			});
		}

		const downUrl1 = softInfo.dom + '/file/' + softInfo.url;
		await fetchPage(downUrl1, 'acw_sc__v2=' + cookie);

		const cookieStr = 'down_ip=1; expires=Sat, 16-Nov-2019 11:42:54 GMT; path=/; domain=.baidupan.com;acw_sc__v2=';
		const downUrl2 = await fetchRedirectUrl(downUrl1, 'https://developer.lanzoug.com', cookieStr);
		const finalUrl = downUrl2.startsWith('http') ? downUrl2 : downUrl1;

		let outputUrl = finalUrl.replace(/pid=(.*?)&/g, '');

		if (rename) {
			const rnMatch = outputUrl.match(/(.*?)\?fn=(.*?)\./);
			if (rnMatch) outputUrl = rnMatch[0] + rename;
		}

		if (type !== 'down') {
			const resp = new Response(JSON.stringify({ code: 200, msg: '解析成功', name: softName, filesize: softFilesize, downUrl: outputUrl }, null, 2), {
				headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
			});
			resp.headers.set('Cache-Control', `public, s-maxage=${CACHE_TTL}, max-age=${CACHE_TTL}`);
			ctx.waitUntil(caches.default.put(new Request(request.url), resp.clone()));
			return resp;
		} else {
			return Response.redirect(outputUrl, 302);
		}
	},
};
