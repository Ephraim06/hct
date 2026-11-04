import React,{useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';
import {auth,ApiError} from '../lib/auth';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Label} from './ui/label';
export function AuthForm({onLogin,audience='admin'}:{onLogin:()=>Promise<void>;audience?:'admin'|'traveller'}){
 const [mode,setMode]=useState<'login'|'register'|'verify'|'recover'>(new URLSearchParams(location.search).get('view')==='signup'?'register':'login');
 const [name,setName]=useState('');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[otp,setOtp]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
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
