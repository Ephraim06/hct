import {findTour} from '../../backend/tours';
type Audience='admin'|'traveller';
export type GoogleClient={signIn:{social:(input:{provider:'google';callbackURL:string;newUserCallbackURL:string;errorCallbackURL:string})=>Promise<{data:unknown;error:{message?:string;code?:string}|null}>}};
/** Only same-origin app routes and a canonical pending tour cross the OAuth round trip. */
export function googleSignInOptions(href:string,audience:Audience){
 const current=new URL(href),callback=new URL(audience==='traveller'?'/account.html':'/admin.html',current.origin);
 const slug=current.searchParams.get('save');if(audience==='traveller'&&slug&&findTour(slug))callback.searchParams.set('save',slug);
 const errorCallback=new URL(callback);errorCallback.searchParams.set('auth_error','google');
 return {provider:'google' as const,callbackURL:callback.href,newUserCallbackURL:callback.href,errorCallbackURL:errorCallback.href};
}
export function googleCallbackMessage(href:string){const query=new URL(href).searchParams;if(query.get('auth_error')!=='google'&&!query.has('error'))return '';const code=query.get('error')||'';return /account.*not.*linked/i.test(code)?'This email already has an account. Sign in with email to continue.':'Google sign-in wasn’t completed. Please try again or use email.';}
export async function continueWithGoogle(client:GoogleClient|null,href:string,audience:Audience){
 if(!client)throw new Error('Sign-in is temporarily unavailable. Please try again.');
 const result=await client.signIn.social(googleSignInOptions(href,audience));
 if(result.error){const detail=result.error.code||result.error.message||'';throw new Error(/provider|configured|client.?id/i.test(detail)?'Google sign-in is not available yet. Please use email or try again shortly.':/account.*not.*linked/i.test(detail)?'This email already has an account. Sign in with email to continue.':'Google sign-in could not start. Please try again or use email.');}
 if(!result.data)throw new Error('Google sign-in could not start. Please try again.');
 return result;
}
