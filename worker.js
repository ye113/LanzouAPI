const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36';

function randIP() {
	const ip1 = ['218','218','66','66','218','218','60','60','202','204','66','66','66','59','61','60','222','221','66','59','60','60','66','218','218','62','63','64','66','66','122','211'];
	const ip2id = Math.round(Math.random() * (2550000 - 600000) + 600000) / 10000;
	const ip3id = Math.round(Math.random() * (2550000 - 600000) + 600000) / 10000;
	const ip4id = Math.round(Math.random() * (2550000 - 600000) + 600000) / 10000;
	const ip1id = ip1[Math.floor(Math.random() * ip1.length)];
	return `${ip1id}.${ip2id}.${ip3id}.${ip4id}`;
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Access-Control-Allow-Origin': '*',
			...extraHeaders,
		},
	});
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

async function fetchPage(url, cookie = '', referer = '') {
	const headers = {
		'User-Agent': USER_AGENT,
		'X-Forwarded-For': randIP(),
		'CLIENT-IP': randIP(),
	};
	if (cookie) headers['Cookie'] = cookie;
	if (referer) headers['Referer'] = referer;
	const resp = await fetch(url, { headers });
	return await resp.text();
}

async function fetchPageWithChallenge(url, cookieState, referer = '') {
	let cookie = cookieState.value || '';
	let response = await fetchPage(url, cookie ? 'acw_sc__v2=' + cookie : '', referer);
	const match = response.match(/var\s+arg1=['"]([0-9a-f]{40})['"]/i);
	if (match) {
		cookie = acwScV2Simple(match[1]);
		cookieState.value = cookie;
		response = await fetchPage(url, 'acw_sc__v2=' + cookie, referer);
	}
	return response;
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
	return resp.headers.get('Location') || resp.headers.get('location') || '';
}

function extractFileName(html) {
	let m = html.match(/style="font-size: 30px;text-align: center;padding: 56px 0px 20px 0px;">(.*?)<\/div>/);
	if (!m) m = html.match(/<div class="n_box_3fn".*?>(.*?)<\/div>/);
	if (!m) m = html.match(/var filename = '(.*?)';/);
	if (!m) m = html.match(/div class="b"><span>(.*?)<\/span><\/div>/);
	return m ? m[1] : '';
}

function extractFileSize(html) {
	let m = html.match(/<div class="n_filesize".*?>大小：(.*?)<\/div>/);
	if (!m) m = html.match(/<span class="p7">文件大小：<\/span>(.*?)<br>/);
	return m ? m[1] : '';
}

function extractAjaxPath(html) {
	const m = html.match(/(?:^|\/)(ajax(?:m|file)\.php\?file=\d+)/m);
	return m ? m[1] : '';
}

function extractPasswordSign(html) {
	// 新版页面：data:{...'sign':(字面量|变量)}，行首锚定 data: 可排除 //data 注释中的伪参数
	const signParam = html.match(/^[ \t]*data\s*:\s*\{[^\r\n]*['"]sign['"]\s*:\s*(?:(['"])(.*?)\1|([A-Za-z_$][\w$]*))/m);
	let sign = signParam && signParam[2] ? signParam[2] : '';
	if (!sign && signParam && signParam[3]) {
		const varName = signParam[3];
		const re = new RegExp(`var\\s+${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*(['"])(.*?)\\1\\s*;`, 'g');
		const values = [];
		let vm;
		while ((vm = re.exec(html)) !== null) {
			if (vm[2]) values.push(vm[2]);
		}
		sign = values.length ? values[values.length - 1] : '';
	}
	if (!sign) {
		const segment = [...html.matchAll(/'sign':'(.*?)',/g)];
		sign = segment.length > 1 ? segment[1][1] : (segment[0] ? segment[0][1] : '');
	}
	return sign;
}

export default {
	async fetch(request, env, ctx) {
		const CACHE_TTL = parseInt(env.CACHE_TTL || '1800');
		const COOKIE = env.COOKIE || '';

		const reqUrl = new URL(request.url);
		const params = reqUrl.searchParams;
		const inputUrl = params.get('url');
		const pwd = params.get('pwd') || '';
		const type = params.get('type');
		const rename = params.get('n');

		const shouldCache = inputUrl && type !== 'down';
		if (shouldCache) {
			const cached = await caches.default.match(new Request(request.url));
			if (cached) return cached;
		}

		if (!inputUrl) {
			return jsonResponse({ code: 400, msg: '请输入URL' });
		}

		let parsed;
		try {
			parsed = new URL(inputUrl);
		} catch {
			return jsonResponse({ code: 400, msg: 'URL格式错误' });
		}
		if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.host || !parsed.pathname) {
			return jsonResponse({ code: 400, msg: 'URL格式错误' });
		}

		// 保留分享链接原始域名。蓝奏云的风控 Cookie 与域名关联，强制换域名会导致校验失败。
		const origin = 'https://' + parsed.host;
		const webpage = parsed.search ? parsed.search.slice(1) : '';
		const normUrl = origin + parsed.pathname + (parsed.search || '');

		const cookieState = { value: COOKIE };
		let html = await fetchPageWithChallenge(normUrl, cookieState);

		if (html.includes('文件取消分享了') || html.includes('文件不存在')) {
			return jsonResponse({ code: 400, msg: '文件取消分享了' });
		}

		let softName = extractFileName(html);
		let softFilesize = extractFileSize(html);
		let softInfo;

		if (html.includes('function down_p(){') && !webpage) {
			if (!pwd) {
				return jsonResponse({ code: 400, msg: '请输入分享密码' });
			}
			const sign = extractPasswordSign(html);
			const ajaxPath = extractAjaxPath(html);
			if (!sign || !ajaxPath) {
				return jsonResponse({ code: 400, msg: '未找到密码页 sign 或下载接口参数' });
			}
			const respText = await postData(
				{ action: 'downprocess', sign, p: pwd, kd: 1 },
				origin + '/' + ajaxPath,
				normUrl,
				'acw_sc__v2=' + cookieState.value
			);
			softInfo = JSON.parse(respText);
			softName = softInfo.inf || softName;
		} else {
			let m = html.match(/\n<iframe.*?name="[\s\S]*?"\ssrc="\/(.*?)"/);
			if (!m) m = html.match(/<iframe.*?name="[\s\S]*?"\ssrc="\/(.*?)"/);
			if (!m || !m[1]) {
				return jsonResponse({ code: 400, msg: '解析失败' });
			}
			const ifurl = origin + '/' + m[1];
			let postDataObj;
			let ajaxPath;

			if (webpage) {
				const segment = [...html.matchAll(/'sign':'(.*?)'/g)];
				ajaxPath = extractAjaxPath(html);
				if (!segment.length || !ajaxPath) {
					return jsonResponse({ code: 400, msg: '解析失败' });
				}
				const sign = segment.length > 1 ? segment[1][1] : segment[0][1];
				postDataObj = { action: 'downprocess', websignkey: 'Em2R', sign, websign: 2, kd: 1, ves: 1 };
			} else {
				html = await fetchPageWithChallenge(ifurl, cookieState, normUrl);
				const wpSignMatch = html.match(/wp_sign = '(.*?)'/);
				const ajaxdataMatch = html.match(/ajaxdata = '(.*?)'/);
				ajaxPath = extractAjaxPath(html);
				if (!wpSignMatch || !ajaxdataMatch || !ajaxPath) {
					return jsonResponse({ code: 400, msg: '解析失败' });
				}
				postDataObj = {
					action: 'downprocess',
					websignkey: ajaxdataMatch[1],
					signs: ajaxdataMatch[1],
					sign: wpSignMatch[1],
					websign: '',
					kd: 1,
					ves: 1,
				};
			}

			const respText = await postData(
				postDataObj,
				origin + '/' + ajaxPath,
				ifurl,
				'acw_sc__v2=' + cookieState.value
			);
			try {
				softInfo = JSON.parse(respText);
			} catch {
				return jsonResponse({ code: 400, msg: '解析失败，蓝奏云返回异常，请稍后重试' });
			}
		}

		if (!softInfo || softInfo.zt !== 1) {
			const errMsg = softInfo && softInfo.inf ? softInfo.inf : '解析失败，蓝奏云返回异常，请稍后重试';
			return jsonResponse({ code: 400, msg: errMsg });
		}

		const downUrl1 = softInfo.dom + '/file/' + softInfo.url;
		await fetchPage(downUrl1, 'acw_sc__v2=' + cookieState.value);

		const cookieStr = 'down_ip=1; acw_sc__v2=' + cookieState.value;
		const downUrl2 = await fetchRedirectUrl(downUrl1, origin, cookieStr);
		let outputUrl = downUrl2 && downUrl2.startsWith('http') ? downUrl2 : downUrl1;

		if (rename) {
			const rnMatch = outputUrl.match(/(.*?)\?fn=(.*?)\./);
			if (rnMatch) outputUrl = rnMatch[0] + rename;
		}

		outputUrl = outputUrl.replace(/pid=(.*?)&/g, '');

		if (type === 'down') {
			return Response.redirect(outputUrl, 302);
		}

		const resp = jsonResponse({
			code: 200,
			msg: '解析成功',
			name: softName,
			filesize: softFilesize,
			downUrl: outputUrl,
		});
		resp.headers.set('Cache-Control', `public, s-maxage=${CACHE_TTL}, max-age=${CACHE_TTL}`);
		ctx.waitUntil(caches.default.put(new Request(request.url), resp.clone()));
		return resp;
	},
};
