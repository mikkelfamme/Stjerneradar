/* Integration-test-only preload: absolutely no real network requests are sent. */
Date.now=()=>Date.parse('2026-10-15T10:00:00.000Z');
globalThis.fetch=async(url,opts)=>{
 if(!String(url).startsWith('https://ntfy.sh/stjerner-'))throw Error('Expected test push to generated ntfy channel.');
 if(opts?.method!=='POST'||opts?.headers?.['X-Cache']!=='no')throw Error('ntfy publish headers incorrect');
 console.log('MOCK_NTFY_ACCEPTED');
 return {ok:true,status:200};
};
