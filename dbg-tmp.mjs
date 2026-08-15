import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
const env = {}
for (const l of fs.readFileSync('.env.preview.local','utf8').split(/\r?\n/)) { const m=/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if(m) env[m[1]]=m[2].replace(/^"(.*)"$/,'$1') }
const url=env.SUPABASE_URL, anon=env.SUPABASE_ANON_KEY, svc=env.SUPABASE_SERVICE_ROLE_KEY
const h={apikey:svc,Authorization:`Bearer ${svc}`,'Content-Type':'application/json'}
const email=`dbg-${Date.now().toString(36)}@sluglines.test`, password='Pw-dbg-12345!'
const cu=await (await fetch(`${url}/auth/v1/admin/users`,{method:'POST',headers:h,body:JSON.stringify({email,password,email_confirm:true})})).json()
const c=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}})
const {data}=await c.auth.signInWithPassword({email,password})
const jar=new Map()
const w=createServerClient(url,anon,{auth:{persistSession:true,autoRefreshToken:false},cookies:{get:n=>jar.get(n),set:(n,v)=>{jar.set(n,v)},remove:n=>{jar.delete(n)}}})
await w.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token})
for(const [k,v] of jar) console.log(`COOKIE ${k} len=${v.length} head=${v.slice(0,40)}`)
// round-trip: can a fresh server client read it back?
const r=createServerClient(url,anon,{auth:{persistSession:true,autoRefreshToken:false},cookies:{get:n=>jar.get(n)}})
const back=await r.auth.getUser()
console.log('ROUNDTRIP user:', back.data.user?.id ?? 'NONE', back.error?.message ?? '')
await fetch(`${url}/auth/v1/admin/users/${cu.id}`,{method:'DELETE',headers:h})
