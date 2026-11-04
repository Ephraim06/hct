import React,{useState,useEffect} from 'react';
import {Eye,EyeOff} from 'lucide-react';
import {continueWithGoogle,googleCallbackMessage} from '../lib/google-auth';
import {auth,ApiError} from '../lib/auth';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Label} from './ui/label';
export function AuthForm({onLogin,audience='admin'}:{onLogin:()=>Promise<void>;audience?:'admin'|'traveller'}){
 const [mode,setMode]=useState<'login'|'register'|'verify'|'recover'>(new URLSearchParams(location.search).get('view')==='signup'?'register':'login');
 const [name,setName]=useState('');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[otp,setOtp]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(()=>googleCallbackMessage(location.href));
 const [googleBusy,setGoogleBusy]=useState(false);
 useEffect(()=>{const restore=()=>{setBusy(false);setGoogleBusy(false);};window.addEventListener('pageshow',restore);const url=new URL(location.href);if(googleCallbackMessage(url.href)){for(const key of ['auth_error','error','error_description','error_code'])url.searchParams.delete(key);history.replaceState(history.state,'',url.href);}return()=>window.removeEventListener('pageshow',restore);},[]);
 async function google(){if(busy)return;setBusy(true);setGoogleBusy(true);setMessage('');try{const result=await continueWithGoogle(auth,location.href,audience);if(typeof result.data==='object'&&result.data&&'user' in result.data){await onLogin();setBusy(false);setGoogleBusy(false);}}catch(error){setMessage(error instanceof Error?error.message:'Google sign-in could not start. Please try again.');setBusy(false);setGoogleBusy(false);}}
 const [showPassword,setShowPassword]=useState(false),[rememberMe,setRememberMe]=useState(false);
 async function sendCode(){
  if(!auth)return;const result=await auth.emailOtp.sendVerificationOtp({email,type:'email-verification'});
  if(result.error)throw new Error(result.error.message||'The code could not be sent.');
  setMode('verify');setMessage('Check your inbox for your verification code.');
 }
 async function submit(event:React.FormEvent){
  event.preventDefault();setBusy(true);setMessage('');
  try{
   if(!auth)throw new Error('The sign-in service is not configured yet.');
   if(mode==='register'){
    const result=await auth.signUp.email({email,password,name:name.trim()||'Happy Cape Tours administrator'});
    if(result.error)throw new Error(result.error.message||'Your account could not be created.');
    await sendCode();
   }else if(mode==='verify'){
    const result=await auth.emailOtp.verifyEmail({email,otp});
    if(result.error)throw new Error(result.error.message||'The verification code is invalid or expired.');
    const signed=await auth.signIn.email({email,password,rememberMe});
    if(signed.error){setMode('login');setMessage('Email verified. Sign in with your password.');return;}
    await onLogin();
   }else if(mode==='recover'){
    const result=await auth.requestPasswordReset({email,redirectTo:new URL(audience==='traveller'?'account.html':'admin.html',location.href).href});
    if(result.error)throw new Error(result.error.message||'Password recovery is unavailable.');
    setMessage('If an account exists, check your inbox for password recovery instructions.');
   }else{
    const result=await auth.signIn.email({email,password,rememberMe});
    if(result.error)throw new Error(result.error.message||'Please check your email and password.');
    await onLogin();
   }
  }catch(error){
   if(error instanceof ApiError && error.code==='EMAIL_UNVERIFIED'){
    setMode('verify');setMessage('Verify your email to continue. Use “Send a new code” below.');
   }else setMessage(error instanceof Error?error.message:'Something went wrong. Please try again.');
  }finally{setBusy(false);}
 }
 const [resetToken]=useState(new URLSearchParams(location.search).get('token'));
 const [resetDone,setResetDone]=useState(false);
 async function reset(event:React.FormEvent){event.preventDefault();setBusy(true);setMessage('');try{
  const result=await auth!.resetPassword({token:resetToken!,newPassword:password});
  if(result.error)throw new Error(result.error.message||'This reset link has expired.');
  setResetDone(true);history.replaceState(null,'',audience==='traveller'?'account.html':'admin.html');setMessage('Password updated. You can now sign in.');setPassword('');
 }catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 const resetting=Boolean(resetToken&&!resetDone);
 const title=resetting?'A fresh start.':mode==='register'?'Your adventure starts here.':mode==='verify'?'Check your inbox.':mode==='recover'?'Forgot your password?':'Welcome back!';
 const description=resetting?'Choose a new password for your account.':mode==='register'?'Create your account and bring your Cape stories to life.':mode==='verify'?'Enter the verification code sent to your email.':mode==='recover'?'Enter your email and we’ll help you get back in.':'Welcome back! Please enter your details.';
 return <div className="admin-login">
 <section className="auth-shell" aria-label="Happy Cape Tours account">
  <div className="auth-visual">
   <a className="auth-brand" href="index.html"><img src="images/logo/circle-logo.png" alt="" width="44" height="44"/><span>HAPPY CAPE<span className="auth-brand-subtitle">TOURS &amp; ADVENTURES</span></span></a>
   <div className="auth-story"><span className="auth-eyebrow">CAPE TOWN · SOUTH AFRICA</span><h2>Your next <br/>Cape adventure<br/><span>starts here.</span></h2><p>A coastline worth exploring. A story worth sharing.<br/>Bring your favourite Cape moments to life.</p><span className="auth-story-note">Make every moment a happy one.</span></div>
   <a href="index.html" className="auth-return">← Back to the website</a>
  </div>
  <div className="auth-form-panel"><div className="auth-form-inner">
   <span className="auth-form-eyebrow">HAPPY CAPE TOURS</span>
   <h2 className="auth-title">{title}</h2><p className="auth-description">{description}</p>
   {!resetting&&(mode==='login'||mode==='register')&&<><Button className="auth-google" variant="outline" type="button" disabled={busy||!auth} aria-busy={googleBusy} onClick={google}>{googleBusy?<span className="hct-button-spinner" aria-hidden="true"/>:<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.42h11a9.4 9.4 0 0 1-4.08 6.17v5.13h6.6c3.86-3.55 6.09-8.78 6.09-14.8Z"/><path fill="#34A853" d="M24 44c5.51 0 10.13-1.83 13.51-4.95l-6.6-5.13c-1.83 1.23-4.17 1.96-6.91 1.96-5.32 0-9.83-3.59-11.44-8.42H5.74v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.56 27.46A12 12 0 0 1 11.93 24c0-1.2.21-2.37.63-3.46v-5.3H5.74A20 20 0 0 0 4 24c0 3.23.77 6.29 2.14 9l6.42-5.54Z"/><path fill="#EA4335" d="M24 12.12c3 0 5.7 1.03 7.82 3.06l5.87-5.87C34.12 5.98 29.51 4 24 4A20 20 0 0 0 5.74 15.24l6.82 5.3C14.17 15.71 18.68 12.12 24 12.12Z"/></svg>}{googleBusy?'Connecting to Google…':'Continue with Google'}</Button><div className="auth-divider"><span>or continue with email</span></div></>}
   <form onSubmit={resetting?reset:submit} className="auth-form">
    {!resetting&&mode==='register'&&audience==='traveller'&&<div className="auth-field"><Label htmlFor="traveller-name">Your name</Label><Input id="traveller-name" autoComplete="name" required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></div>}
    {!resetting&&<div className="auth-field"><Label htmlFor="admin-email">Email</Label><Input id="admin-email" type="email" placeholder="Enter your email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>}
    {(resetting||mode==='login'||mode==='register')&&<div className="auth-field"><Label htmlFor="admin-password">Password</Label><div className="auth-password"><Input id="admin-password" type={showPassword?'text':'password'} placeholder={mode==='register'||resetting?'Create a strong password':'Enter your password'} autoComplete={mode==='register'||resetting?'new-password':'current-password'} minLength={mode==='register'||resetting?12:undefined} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/><button className="auth-password-toggle" type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<Eye size={19}/>:<EyeOff size={19}/>}</button></div>{(mode==='register'||resetting)&&<p className="auth-hint">Use at least 12 characters.</p>}</div>}
    {mode==='verify'&&!resetting&&<div className="auth-field"><Label htmlFor="verification-code">Verification code</Label><Input id="verification-code" placeholder="Enter your code" inputMode="numeric" autoComplete="one-time-code" required value={otp} onChange={e=>setOtp(e.target.value)} /></div>}
    {mode==='login'&&!resetting&&<div className="auth-options"><label className="auth-remember"><input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)}/>Remember me</label><button type="button" className="auth-text-button" disabled={busy} onClick={()=>{setMode('recover');setMessage('');}}>Forgot password?</button></div>}
    <p className="auth-status" role="status" aria-live="polite">{message}</p>
    <Button className="auth-submit" type="submit" disabled={busy||!auth}>{busy?'Please wait…':resetting?'Save new password':mode==='register'?'Create account':mode==='verify'?'Verify email':mode==='recover'?'Send reset instructions':'Sign in'}<span aria-hidden="true">→</span></Button>
   </form>
   {!resetting&&<div className="auth-switch">
    <p>{mode==='login'?'Don’t have an account?':mode==='register'?'Already have an account?':'Ready to sign in?'} <button className="auth-text-button" disabled={busy} onClick={()=>{setMode(mode==='login'?'register':'login');setMessage('');setShowPassword(false);}}>{mode==='login'?'Sign up':'Sign in'}</button></p>
    {mode==='verify'&&<button className="auth-text-button auth-resend" disabled={busy||!email} onClick={async()=>{setBusy(true);try{await sendCode();}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}}>Send a new code</button>}
   </div>}
   <p className="auth-access-note">{audience==='traveller'?'Save your favourite tours and plan your next Cape adventure.':'For approved Happy Cape Tours administrators.'}</p>
  </div></div>
 </section>
 </div>;

}
