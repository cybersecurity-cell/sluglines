interface ProfileFormProps {
  action: string | ((formData: FormData) => void | Promise<void>)
  displayName: string
}

export function ProfileForm({ action, displayName }: ProfileFormProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-black">Profile</h2>
      <form action={action as string} className="mt-5">
        <label className="block text-sm font-bold text-slate-800" htmlFor="profile-display-name">Display name</label>
        <input autoComplete="name" className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" defaultValue={displayName} id="profile-display-name" maxLength={80} minLength={2} name="displayName" required />
        <button className="mt-4 min-h-11 rounded-xl bg-blue-700 px-5 font-bold text-white hover:bg-blue-800" type="submit">Save profile</button>
      </form>
    </section>
  )
}
