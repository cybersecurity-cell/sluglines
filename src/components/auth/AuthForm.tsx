import Link from 'next/link'

type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password' | 'reset-password'

interface AuthFormProps {
  action: string | ((formData: FormData) => void | Promise<void>)
  mode: AuthMode
  message?: string
  next?: string
}

const content: Record<AuthMode, { title: string; introduction: string; submit: string }> = {
  'sign-in': { title: 'Welcome back', introduction: 'Sign in to manage saved locations and commute preferences.', submit: 'Sign in' },
  'sign-up': { title: 'Create your account', introduction: 'Save useful locations and keep your commute preferences in one place.', submit: 'Create account' },
  'forgot-password': { title: 'Reset your password', introduction: 'Enter your email. We will send the same response whether or not an account exists.', submit: 'Send reset link' },
  'reset-password': { title: 'Choose a new password', introduction: 'Use a unique password with at least 12 characters.', submit: 'Update password' },
}

const inputClass = 'mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'

export function AuthForm({ action, mode, message, next }: AuthFormProps) {
  const copy = content[mode]
  const needsEmail = mode !== 'reset-password'
  const needsPassword = mode === 'sign-in' || mode === 'sign-up' || mode === 'reset-password'

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-3xl font-black tracking-tight text-slate-950">{copy.title}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">{copy.introduction}</p>
      {message ? <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert">{message}</p> : null}

      <form action={action as string} className="mt-6 space-y-5">
        {next ? <input name="next" type="hidden" value={next} /> : null}
        {mode === 'sign-up' ? <div><label className="block text-sm font-bold text-slate-800" htmlFor="display-name">Display name</label><input autoComplete="name" className={inputClass} id="display-name" maxLength={80} minLength={2} name="displayName" required type="text" /></div> : null}
        {needsEmail ? <div><label className="block text-sm font-bold text-slate-800" htmlFor="email">Email address</label><input autoComplete="email" className={inputClass} id="email" maxLength={254} name="email" required type="email" /></div> : null}
        {needsPassword ? <div><label className="block text-sm font-bold text-slate-800" htmlFor="password">Password</label><input aria-describedby={mode === 'sign-up' || mode === 'reset-password' ? 'password-help' : undefined} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} className={inputClass} id="password" minLength={12} name="password" required type="password" />{mode === 'sign-up' || mode === 'reset-password' ? <p className="mt-2 text-xs text-slate-500" id="password-help">At least 12 characters. A password manager can create and store one for you.</p> : null}</div> : null}
        <button className="min-h-12 w-full rounded-xl bg-blue-700 px-5 font-bold text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" type="submit">{copy.submit}</button>
      </form>

      {mode === 'sign-in' ? <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm"><Link className="font-semibold text-blue-700 hover:underline" href="/auth/forgot-password">Forgot your password?</Link><Link className="font-semibold text-blue-700 hover:underline" href="/auth/sign-up">Create an account</Link></div> : null}
      {mode === 'sign-up' || mode === 'forgot-password' ? <p className="mt-6 text-sm text-slate-600">Already registered? <Link className="font-semibold text-blue-700 hover:underline" href="/auth/sign-in">Sign in</Link></p> : null}
    </div>
  )
}
