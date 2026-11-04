import {createAuthClient} from '@neondatabase/auth';
import {getAccessToken} from './session';
declare global {interface Window {HCT_BACKEND?:{apiBaseUrl:string;authUrl:string}}}
const config=window.HCT_BACKEND;
export const apiBase=config?.apiBaseUrl?.replace(/\/$/,'');
// These Managed Auth endpoints are documented by the SDK's endpoint map;
// its beta declaration loses plugin inference with patched Better Auth versions.
type AuthResult<T> = Promise<{data:T|null;error:{message?:string}|null}>;
type ManagedExtensions = {
 emailOtp:{sendVerificationOtp:(input:{email:string;type:'email-verification'})=>AuthResult<unknown>;verifyEmail:(input:{email:string;otp:string})=>AuthResult<unknown>};
};
const createManagedClient = (url:string) => createAuthClient(url);
export const auth=config?.authUrl ? createManagedClient(config.authUrl) as ReturnType<typeof createManagedClient> & ManagedExtensions : null;
export class ApiError extends Error {constructor(message:string,public status:number,public code?:string){super(message);}}
export async function api(path:string, options:RequestInit={}){
 if(!auth||!apiBase)throw new Error('The gallery service has not been configured.');
 const token=await getAccessToken(auth);if(!token)throw new ApiError('Your sign-in session could not be restored. Please sign in again.',401);
 const response=await fetch(apiBase+path,{...options,headers:{...options.headers,Authorization:`Bearer ${token}`}});
 const body=await response.json().catch(()=>({error:'The service returned an unexpected response.'}));
 if(!response.ok)throw new ApiError(body.error||'Request failed.',response.status,body.code);
 return body;
}
