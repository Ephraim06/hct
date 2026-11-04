type SessionResult = {data:{session:{token?:string}|null}|null;error:unknown};
/** This installed Neon SDK exposes its bearer JWT on getSession().data.session.token. */
export async function getAccessToken(client:{getSession:()=>Promise<SessionResult>}):Promise<string|null>{
 const {data,error}=await client.getSession();
 const token=data?.session?.token;
 if(error||typeof token!=='string'||token.split('.').length!==3)return null;
 return token;
}
